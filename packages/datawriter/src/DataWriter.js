import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import matter from "@11ty/gray-matter";
import lodash from "@11ty/lodash-custom";
import { TemplatePath, isPlainObject } from "@11ty/eleventy-utils";

import {
	parseTree,
	findNodeAtLocation,
	getNodeValue,
	modify,
	applyEdits,
} from "./adapters/jsonc.js";
import { getYamlEdit, DataWriterPreservationError, renderInline } from "./YamlSurgicalEdit.js";
import DirContains from "./DirContains.js";

const { get: lodashGet, set: lodashSet } = lodash;

class DataWriterError extends Error {
	name = "DataWriterError";
}

/* Data properties Eleventy supplies itself. Writing one produces a file that either
 * throws on the next build or is silently overwritten, so they are refused by default.
 * Pass `reservedKeys` to override the list, or `[]` to disable the check entirely.
 * Mirrors `ReservedData` in @11ty/eleventy; kept in sync by a test in that repo.
 */
const DEFAULT_RESERVED_KEYS = [
	"pkg",
	"eleventy",
	"buildawesome",
	"content",
	"collections",
	"page.date",
	"page.inputPath",
	"page.fileSlug",
	"page.filePathStem",
	"page.outputFileExtension",
	"page.templateSyntax",
	"page.url",
	"page.outputPath",
];

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
function assertNotReserved(pathArray, filePath, reservedKeys) {
	let [first, second] = pathArray;

	// `page` is reserved only for the specific sub-properties Eleventy sets.
	let candidate = first === "page" && second !== undefined ? `page.${second}` : String(first);

	if (reservedKeys.includes(candidate)) {
		throw new DataWriterError(
			`\`${candidate}\` is a reserved data property name, so writing it to ${filePath} would have no effect. Pass \`reservedKeys\` to change the list.`,
		);
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

function readJson(source, pathArray) {
	let tree = parseTree(source);
	let node = tree ? findNodeAtLocation(tree, pathArray) : undefined;
	return { node, value: node ? getNodeValue(node) : undefined };
}

/* Returns the updated text, or `unchanged` when the value is already what was asked for. */
function editJson(source, pathArray, value, operation = "set") {
	let { node, value: previousValue } = readJson(source, pathArray);
	let formattingOptions = detectJsonFormatting(source);

	if (operation === "append" || operation === "prepend") {
		if (node === undefined || previousValue === undefined) {
			// Nothing there yet: create the key holding a single-item array.
			return {
				previousValue,
				updated: applyEdits(source, modify(source, pathArray, [value], { formattingOptions })),
			};
		}

		if (!Array.isArray(previousValue)) {
			throw new DataWriterError(
				`Cannot ${operation} to \`${pathArray.join(".")}\`: the target is not an array.`,
			);
		}

		let index = operation === "prepend" ? 0 : previousValue.length;
		let edits = modify(source, [...pathArray, index], value, {
			formattingOptions,
			isArrayInsertion: true,
		});

		return { previousValue, updated: applyEdits(source, edits) };
	}

	if (node && isDeepEqual(previousValue, value)) {
		return { previousValue, unchanged: true };
	}

	return {
		previousValue,
		updated: applyEdits(source, modify(source, pathArray, value, { formattingOptions })),
	};
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
		let result = editJson(block, pathArray, value, options.operation);
		if (result.unchanged) {
			return { previousValue: result.previousValue, unchanged: true };
		}
		return {
			previousValue: result.previousValue,
			updated: source.slice(0, blockStart) + result.updated + source.slice(blockEnd),
		};
	}

	let previousValue = lodashGet(file.data, pathArray);
	let isInsertion = options.operation === "append" || options.operation === "prepend";
	if (!isInsertion && isDeepEqual(previousValue, value)) {
		return { previousValue, unchanged: true };
	}

	let edit = getYamlEdit(block, pathArray, value, { selector, operation: options.operation });

	return {
		previousValue,
		updated:
			source.slice(0, blockStart + edit.start) +
			edit.replacement +
			source.slice(blockStart + edit.end),
	};
}

function getOperation(options, pathArray) {
	let requested = ["append", "prepend"].filter((name) => options[name]);

	if (requested.length > 1) {
		throw new DataWriterError(
			`Only one of \`append\` or \`prepend\` may be set (received ${requested.join(", ")}).`,
		);
	}

	if (requested.length === 1 && pathArray.length === 0) {
		throw new DataWriterError(`\`${requested[0]}\` needs a selector to write to.`);
	}

	return requested[0] ?? "set";
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
 * @param {Array<string>} [options.reservedKeys] - Property names to refuse. Defaults to the
 * data properties Eleventy supplies itself; pass `[]` to disable the check.
 * @param {boolean} [options.append] - Add the value to the end of the array at `selector`.
 * @param {boolean} [options.prepend] - Add the value to the start of the array at `selector`.
 * @returns {{path: string, selector: string, value: any, previousValue: any, created: boolean, written: boolean}}
 */
function write(filePath, selector, value, options = {}) {
	if (typeof filePath !== "string" || filePath.length === 0) {
		throw new DataWriterError("Expected a file path to write to.");
	}

	let normalized = TemplatePath.addLeadingDotSlash(TemplatePath.standardizeFilePath(filePath));
	let pathArray = toPath(selector);

	assertNotReserved(pathArray, normalized, options.reservedKeys ?? DEFAULT_RESERVED_KEYS);
	assertInsideProject(normalized);

	let extension = getExtension(normalized);

	if (JAVASCRIPT_EXTENSIONS.has(extension)) {
		throw new DataWriterError(
			`Writing to \`.${extension}\` data files is not yet supported: ${normalized}`,
		);
	}

	let operation = getOperation(options, pathArray);

	let exists = existsSync(normalized);
	let source = exists ? readFileSync(normalized, "utf8") : "";
	let text = exists ? source : extension === "json" ? "{}\n" : "";

	let result =
		extension === "json"
			? { ...editJson(text, pathArray, value, operation), created: !exists }
			: editFrontMatter(text, pathArray, value, { ...options, selector, operation });

	let created = Boolean(result.created) || !exists;
	let { previousValue } = result;

	if (result.unchanged) {
		return { path: normalized, selector, value, previousValue, created: false, written: false };
	}

	writeToDisk(normalized, result.updated);

	return { path: normalized, selector, value, previousValue, created, written: true };
}

/* ---------- Storage keys ---------- */

/* storageKey -> resolver. Registered by the consuming app, which owns the decision of
 * where a given key lives on disk and how its incoming fields map onto data properties.
 */
const storageKeys = new Map();

/**
 * Maps a `storageKey` onto a data file location, so an app can accept a write addressed
 * by an opaque key rather than a file path.
 *
 * The resolver receives the incoming data object and returns where it lands on disk.
 *
 * The resolver owns the whole translation: which file, which property, and what the value
 * becomes. Returning nothing refuses the write.
 *
 * @param {string} storageKey
 * @param {(data: object, storageKey: string) => ({filePath: string, selector: string, value: any, append?: boolean, prepend?: boolean}|undefined)} resolver
 */
function addStorageKey(storageKey, resolver) {
	if (typeof storageKey !== "string" || storageKey.length === 0) {
		throw new DataWriterError("Expected a non-empty storage key.");
	}

	if (typeof resolver !== "function") {
		throw new DataWriterError(
			`Expected a resolver function for storage key \`${storageKey}\`, received ${typeof resolver}.`,
		);
	}

	storageKeys.set(storageKey, resolver);
}

function removeStorageKey(storageKey) {
	return storageKeys.delete(storageKey);
}

function clearStorageKeys() {
	storageKeys.clear();
}

function getStorageKeys() {
	return [...storageKeys.keys()];
}

/**
 * Writes a data object addressed by `storageKey`, using the resolver registered for it.
 *
 * @param {string} storageKey
 * @param {object} data - The incoming fields, e.g. `{ author, body }`.
 * @param {object} [options] - Passed through to `write`.
 * @returns {{path: string, selector: string, value: any, previousValue: any, created: boolean, written: boolean, storageKey: string}}
 */
function writeStorage(storageKey, data, options = {}) {
	if (typeof storageKey !== "string" || storageKey.length === 0) {
		throw new DataWriterError("Expected a non-empty storage key.");
	}

	if (!isPlainObject(data)) {
		throw new DataWriterError(
			`Expected a data object for storage key \`${storageKey}\`, received ${typeof data}.`,
		);
	}

	let resolver = storageKeys.get(storageKey);
	if (!resolver) {
		throw new DataWriterError(
			`No storage key registered for \`${storageKey}\`. Registered: ${getStorageKeys().join(", ") || "(none)"}.`,
		);
	}

	let resolved = resolver(data, storageKey);

	if (!isPlainObject(resolved)) {
		throw new DataWriterError(`The resolver for \`${storageKey}\` refused the write.`);
	}

	let { filePath, selector, value, append, prepend } = resolved;

	if (typeof filePath !== "string" || typeof selector !== "string") {
		throw new DataWriterError(
			`The resolver for \`${storageKey}\` must return \`filePath\` and \`selector\` strings.`,
		);
	}

	return {
		...write(filePath, selector, value, {
			...options,
			...(resolved.options ?? {}),
			...(append ? { append } : {}),
			...(prepend ? { prepend } : {}),
		}),
		storageKey,
	};
}

export const DataWriter = Object.freeze({
	write,
	writeStorage,
	addStorageKey,
	removeStorageKey,
	clearStorageKeys,
	getStorageKeys,
});
export { DataWriterError, DataWriterPreservationError, DEFAULT_RESERVED_KEYS };
export default DataWriter;
