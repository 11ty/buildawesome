import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import matter from "@11ty/gray-matter";
import lodash from "@11ty/lodash-custom";
import { TemplatePath } from "@11ty/eleventy-utils";

import {
	parseTree,
	findNodeAtLocation,
	getNodeValue,
	modify,
	applyEdits,
} from "../Adapters/Packages/jsonc.js";
import {
	getYamlEdit,
	DataWriterPreservationError,
	renderInline,
} from "../Util/YamlSurgicalEdit.js";
import DirContains from "../Util/DirContains.js";
import ReservedData from "../Util/ReservedData.js";
import BaseError from "../Errors/BaseError.js";

const { get: lodashGet, set: lodashSet } = lodash;

class DataWriterError extends BaseError {}

// Reserved for a planned mode: editing the exported data object of a JS/TS data file.
const JAVASCRIPT_EXTENSIONS = new Set(["js", "cjs", "mjs", "ts", "cts", "mts"]);

// gray-matter@3 registers `yaml`, `json`, and a `javascript` engine that throws by design.
const WRITABLE_FRONT_MATTER_LANGUAGES = new Set(["yaml", "yml", "json"]);

const DEFAULT_FRONT_MATTER_FORMAT = "yaml";
const DELIMITER = "---";

/**
 * Converts a lodash-style selector into a path array.
 * Numbers come only from bracket syntax, so `a.0` is the string key `"0"`.
 *
 * @param {string} selector - e.g. `nav[0].title`
 * @returns {Array<string|number>}
 */
function toPath(selector) {
	if (Array.isArray(selector)) {
		return selector;
	}

	if (typeof selector !== "string" || selector.length === 0) {
		throw new DataWriterError("Expected a non-empty data selector.");
	}

	let segments = [];
	let pattern = /\[\s*(?:(\d+)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*\]|([^.[\]]+)/g;
	let match;
	let consumed = 0;

	while ((match = pattern.exec(selector)) !== null) {
		let [full, index, doubleQuoted, singleQuoted, bare] = match;
		consumed += full.length;

		if (index !== undefined) {
			segments.push(Number(index));
		} else if (doubleQuoted !== undefined) {
			segments.push(doubleQuoted.replace(/\\(.)/g, "$1"));
		} else if (singleQuoted !== undefined) {
			segments.push(singleQuoted.replace(/\\(.)/g, "$1"));
		} else {
			segments.push(bare);
		}
	}

	if (segments.length === 0) {
		throw new DataWriterError(`Could not parse the data selector \`${selector}\`.`);
	}

	// Every character except the `.` separators must have been consumed.
	if (consumed + (selector.match(/\./g)?.length ?? 0) < selector.length) {
		throw new DataWriterError(`Could not parse the data selector \`${selector}\`.`);
	}

	return segments;
}

function getExtension(filePath) {
	return path.parse(filePath).ext.replace(/^\./, "").toLowerCase();
}

function detectJsonFormatting(source) {
	let match = /\r?\n([ \t]+)["}\]]/.exec(source);
	let insertSpaces = !match || match[1][0] !== "\t";

	return {
		eol: source.includes("\r\n") ? "\r\n" : "\n",
		insertSpaces,
		tabSize: match ? (insertSpaces ? match[1].length : 1) : 2,
	};
}

function isDeepEqual(a, b) {
	if (a === b) {
		return true;
	}
	try {
		return JSON.stringify(a) === JSON.stringify(b);
	} catch {
		return false;
	}
}

/* Refuse anything the data cascade would throw away or overwrite on the next build. */
function assertNotReserved(pathArray, filePath) {
	let [first, second] = pathArray;
	let probe = {};

	if (first === "page" && second !== undefined) {
		probe.page = { [second]: true };
	} else {
		probe[first] = true;
	}

	let reservedNames = ReservedData.getReservedKeys(probe, ReservedData.fullProperties);
	if (reservedNames.length > 0) {
		throw ReservedData.getError({ reservedNames, sourceLocation: filePath });
	}
}

function assertInsideProject(filePath) {
	if (!DirContains(TemplatePath.getWorkingDir(), filePath)) {
		throw new DataWriterError(`Refusing to write outside of the project directory: ${filePath}`);
	}
}

function writeToDisk(filePath, content) {
	let dir = path.parse(filePath).dir;
	if (dir && !existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	// Deliberately synchronous, matching the rest of Eleventy’s writes.
	// https://github.com/11ty/eleventy/issues/3271
	writeFileSync(filePath, content);
}

/* ---------- JSON documents ---------- */

/* Returns the updated text, or undefined when the value is already what was asked for. */
function editJson(source, pathArray, value) {
	let tree = parseTree(source);
	let node = tree ? findNodeAtLocation(tree, pathArray) : undefined;
	let previousValue = node ? getNodeValue(node) : undefined;

	if (node && isDeepEqual(previousValue, value)) {
		return { previousValue, unchanged: true };
	}

	let edits = modify(source, pathArray, value, {
		formattingOptions: detectJsonFormatting(source),
	});

	return { previousValue, updated: applyEdits(source, edits) };
}

/* ---------- Front matter ---------- */

/* gray-matter tells us where the block is; we never let it re-serialize the file.
 * Its `stringify()` drops the language tag and discards every comment.
 */
function locateFrontMatter(source) {
	if (!matter.test(source)) {
		return undefined;
	}

	let language = matter.language(source, {});
	let name = language.name || "yaml";

	// Check the language before parsing: gray-matter’s `javascript` engine throws by
	// design, and an unregistered one (e.g. toml) throws too. Both would surface as
	// opaque gray-matter errors rather than something a caller can act on.
	if (!WRITABLE_FRONT_MATTER_LANGUAGES.has(name)) {
		throw new DataWriterError(
			`Writing \`${name}\` front matter is not yet supported. Supported languages are \`yaml\` and \`json\`.`,
		);
	}

	// Always pass options: with a falsy argument gray-matter returns a shared cached object.
	let file = matter(source, {});
	let blockStart = DELIMITER.length + language.raw.length;

	return {
		file,
		language: name,
		blockStart,
		blockEnd: blockStart + file.matter.length,
	};
}

function buildFrontMatterBlock(pathArray, value, format, eol) {
	let tag = format === "json" ? "json" : "";
	let body =
		format === "json"
			? JSON.stringify(lodashSet({}, pathArray, value), null, 2)
			: pathArray
					.map((segment, depth) =>
						depth === pathArray.length - 1
							? `${"  ".repeat(depth)}${renderInline(String(segment))}: ${renderInline(value)}`
							: `${"  ".repeat(depth)}${renderInline(String(segment))}:`,
					)
					.join(eol);

	return `${DELIMITER}${tag}${eol}${body}${eol}${DELIMITER}${eol}`;
}

function editFrontMatter(source, pathArray, value, options) {
	let eol = source.includes("\r\n") ? "\r\n" : "\n";
	let located = locateFrontMatter(source);

	if (!located) {
		// Body-only file (or an empty one): prepend a block, leave the body untouched.
		let format = options.format ?? DEFAULT_FRONT_MATTER_FORMAT;
		if (!WRITABLE_FRONT_MATTER_LANGUAGES.has(format)) {
			throw new DataWriterError(
				`Unknown front matter format \`${format}\`. Supported formats are \`yaml\` and \`json\`.`,
			);
		}

		return {
			previousValue: undefined,
			created: true,
			updated: buildFrontMatterBlock(pathArray, value, format, eol) + source,
		};
	}

	let { file, language, blockStart, blockEnd } = located;
	let block = source.slice(blockStart, blockEnd);
	let selector = options.selector;

	if (language === "json") {
		let result = editJson(block, pathArray, value);
		if (result.unchanged) {
			return { previousValue: result.previousValue, unchanged: true };
		}
		return {
			previousValue: result.previousValue,
			updated: source.slice(0, blockStart) + result.updated + source.slice(blockEnd),
		};
	}

	let previousValue = lodashGet(file.data, pathArray);
	if (isDeepEqual(previousValue, value)) {
		return { previousValue, unchanged: true };
	}

	let edit = getYamlEdit(block, pathArray, value, { selector });

	return {
		previousValue,
		updated:
			source.slice(0, blockStart + edit.start) +
			edit.replacement +
			source.slice(blockStart + edit.end),
	};
}

/* ---------- Public API ---------- */

/**
 * Writes a single value into a data file or a template’s front matter.
 *
 * The write is surgical: it replaces the smallest possible span of source text, so
 * comments, key order, quoting and indentation elsewhere in the file are untouched.
 * When an edit cannot be made without reformatting, it throws instead.
 *
 * @param {string} filePath - Data file or template to write to. Created if missing.
 * @param {string} selector - Where to write, e.g. `title` or `nav[0].title`.
 * @param {any} value - The new value.
 * @param {object} [options]
 * @param {"yaml"|"json"} [options.format] - Language for a front matter block being created.
 * @returns {{path: string, selector: string, value: any, previousValue: any, created: boolean, written: boolean}}
 */
function write(filePath, selector, value, options = {}) {
	if (typeof filePath !== "string" || filePath.length === 0) {
		throw new DataWriterError("Expected a file path to write to.");
	}

	let normalized = TemplatePath.addLeadingDotSlash(TemplatePath.standardizeFilePath(filePath));
	let pathArray = toPath(selector);

	assertNotReserved(pathArray, normalized);
	assertInsideProject(normalized);

	let extension = getExtension(normalized);

	if (JAVASCRIPT_EXTENSIONS.has(extension)) {
		throw new DataWriterError(
			`Writing to \`.${extension}\` data files is not yet supported: ${normalized}`,
		);
	}

	let exists = existsSync(normalized);
	let source = exists ? readFileSync(normalized, "utf8") : "";
	let result;

	if (extension === "json") {
		let edit = editJson(exists ? source : "{}\n", pathArray, value);
		result = { ...edit, created: !exists };
	} else {
		result = editFrontMatter(source, pathArray, value, { ...options, selector });
		result.created = result.created || !exists;
	}

	if (result.unchanged) {
		return {
			path: normalized,
			selector,
			value,
			previousValue: result.previousValue,
			created: false,
			written: false,
		};
	}

	writeToDisk(normalized, result.updated);

	return {
		path: normalized,
		selector,
		value,
		previousValue: result.previousValue,
		created: Boolean(result.created),
		written: true,
	};
}

export const DataWriter = Object.freeze({ write });
export { DataWriterError, DataWriterPreservationError, toPath };
export default DataWriter;
