import lodash from "@11ty/lodash-custom";

import {
	parseEvents,
	load,
	getScalarValue,
	dump,
	EVENT_ID,
	SCALAR_STYLE,
	COLLECTION_STYLE,
	CHOMPING_MODE,
} from "./adapters/yaml.js";

const { get: lodashGet } = lodash;

const DEFAULT_INDENT_STEP = 2;

/**
 * Thrown when an edit cannot be made without reformatting the document.
 * `DataWriter` never reformats: it makes a surgical edit or refuses.
 */
class DataWriterPreservationError extends Error {
	name = "DataWriterPreservationError";
}

/* Render a value as a single-line YAML node.
 * `dump` picks quoting for us (`yes` and `123` become quoted strings, and so on).
 * Objects and arrays come back as flow collections, which sidesteps block re-indentation.
 */
function renderInline(value) {
	let out = dump(value, { flowLevel: 0, lineWidth: -1 }).trimEnd();

	if (out.includes("\n")) {
		// Multi-line strings dump as block scalars, which can’t sit in an inline span.
		out = dump(value, { flowLevel: 0, lineWidth: -1, forceQuotes: true }).trimEnd();
	}

	if (out.includes("\n")) {
		throw new DataWriterPreservationError(
			`Could not render the value as a single-line YAML node (received ${typeof value}).`,
		);
	}

	return out;
}

function detectEol(source) {
	return source.includes("\r\n") ? "\r\n" : "\n";
}

function lineStartIndex(source, offset) {
	let newline = source.lastIndexOf("\n", offset - 1);
	return newline === -1 ? 0 : newline + 1;
}

function indentAt(source, offset) {
	let start = lineStartIndex(source, offset);
	return /^[ \t]*/.exec(source.slice(start, offset))?.[0] ?? "";
}

/* Builds a tree from the flat event stream. The stream is
 * DOCUMENT, <node>, POP — where a collection node is bracketed by its own POP.
 */
function buildTree(events) {
	let index = 0;

	function readNode() {
		let event = events[index];
		if (!event) {
			return undefined;
		}

		if (event.type === EVENT_ID.SCALAR) {
			index++;
			return { type: "scalar", event };
		}

		if (event.type === EVENT_ID.ALIAS) {
			index++;
			return { type: "alias", event };
		}

		if (event.type === EVENT_ID.MAPPING) {
			index++;
			let entries = [];
			while (events[index] && events[index].type !== EVENT_ID.POP) {
				let key = readNode();
				let value = readNode();
				entries.push({ key, value });
			}
			let popIndex = index;
			index++; // consume POP
			return { type: "mapping", event, entries, popIndex };
		}

		if (event.type === EVENT_ID.SEQUENCE) {
			index++;
			let items = [];
			while (events[index] && events[index].type !== EVENT_ID.POP) {
				items.push(readNode());
			}
			let popIndex = index;
			index++; // consume POP
			return { type: "sequence", event, items, popIndex };
		}

		// DOCUMENT or a stray POP
		index++;
		return readNode();
	}

	return readNode();
}

/* The source offset of the first node that starts after `popIndex`, i.e. where the
 * collection that just closed stops owning the document. -1 when nothing follows.
 */
function offsetAfter(events, popIndex) {
	for (let index = popIndex + 1; index < events.length; index++) {
		let event = events[index];
		if (event.type === EVENT_ID.SCALAR && event.valueStart >= 0) {
			return event.valueStart;
		}
		if (event.type === EVENT_ID.MAPPING || event.type === EVENT_ID.SEQUENCE) {
			return event.start;
		}
		if (event.type === EVENT_ID.ALIAS && event.anchorStart >= 0) {
			return event.anchorStart;
		}
	}
	return -1;
}

function keyText(source, node) {
	if (node?.type !== "scalar" || node.event.valueStart < 0) {
		return undefined;
	}
	return getScalarValue(source, node.event);
}

/* Walks `pathArray` through the tree, refusing anything whose edit we could not
 * make surgically. Returns the target node, or the deepest mapping we reached
 * plus the path segments still to create.
 */
function resolvePath(source, root, pathArray, selector) {
	let node = root;

	for (let depth = 0; depth < pathArray.length; depth++) {
		let segment = pathArray[depth];
		let traversed = pathArray.slice(0, depth).join(".") || "(root)";

		if (node?.type === "alias") {
			throw new DataWriterPreservationError(
				`Cannot write \`${selector}\`: the path goes through a YAML alias at \`${traversed}\`, so the value is defined elsewhere in the document.`,
			);
		}

		if (node?.type === "mapping") {
			// A flow mapping can be traversed to replace an existing scalar; only
			// *inserting* into one is refused (see buildInsertion).
			let matches = node.entries.filter((entry) => keyText(source, entry.key) === String(segment));

			if (matches.length > 1) {
				throw new DataWriterPreservationError(
					`Cannot write \`${selector}\`: the key \`${segment}\` appears ${matches.length} times at \`${traversed}\`, so the target is ambiguous.`,
				);
			}

			if (node.entries.some((entry) => keyText(source, entry.key) === "<<")) {
				throw new DataWriterPreservationError(
					`Cannot write \`${selector}\`: \`${traversed}\` uses a YAML merge key (\`<<\`), so the effective value may come from another node.`,
				);
			}

			if (matches.length === 0) {
				return { found: false, parent: node, remaining: pathArray.slice(depth) };
			}

			node = matches[0].value;
			continue;
		}

		if (node?.type === "sequence") {
			if (typeof segment !== "number") {
				throw new DataWriterPreservationError(
					`Cannot write \`${selector}\`: \`${traversed}\` is a sequence, but \`${segment}\` is not an index.`,
				);
			}

			if (segment >= node.items.length) {
				throw new DataWriterPreservationError(
					`Cannot write \`${selector}\`: index ${segment} is past the end of the sequence at \`${traversed}\`. Appending to a YAML sequence is not yet supported.`,
				);
			}

			node = node.items[segment];
			continue;
		}

		throw new DataWriterPreservationError(
			`Cannot write \`${selector}\`: \`${traversed}\` is a scalar, so it has no \`${segment}\` to write into.`,
		);
	}

	return { found: true, node };
}

function assertReplaceable(node, selector) {
	if (node.type === "alias") {
		throw new DataWriterPreservationError(
			`Cannot write \`${selector}\`: the target is a YAML alias, so writing it would change another node.`,
		);
	}

	if (node.type !== "scalar") {
		throw new DataWriterPreservationError(
			`Cannot write \`${selector}\`: the target is a ${node.type}, and replacing a collection wholesale would reformat it. Write to a key inside it instead.`,
		);
	}

	if (node.event.tagStart >= 0) {
		throw new DataWriterPreservationError(
			`Cannot write \`${selector}\`: the target carries an explicit YAML tag, which the new value may not satisfy.`,
		);
	}
}

/* Replacement span for an existing scalar. Quoted scalars report a span that
 * excludes their quote characters, so a string can keep the original quoting
 * style while anything else widens the span to swallow the quotes.
 */
function replaceScalar(source, node, value, selector) {
	let { event } = node;
	let { valueStart, valueEnd, style } = event;

	if (style === SCALAR_STYLE.LITERAL_BLOCK || style === SCALAR_STYLE.FOLDED_BLOCK) {
		if (typeof value !== "string") {
			throw new DataWriterPreservationError(
				`Cannot write \`${selector}\`: the target is a block scalar and the new value is not a string, so its indicator and chomping could not be preserved.`,
			);
		}

		let eol = detectEol(source);
		let indent = " ".repeat(event.indent > 0 ? event.indent : DEFAULT_INDENT_STEP);
		let body = value
			.split("\n")
			.map((line) => (line.length > 0 ? indent + line : line))
			.join(eol);

		// CLIP and KEEP both end the block with a newline; STRIP does not.
		let replacement = event.chomping === CHOMPING_MODE.STRIP ? body : body + eol;
		return { start: valueStart, end: valueEnd, replacement };
	}

	if (
		style === SCALAR_STYLE.SINGLE_QUOTED &&
		typeof value === "string" &&
		!/[\n\r\t]/.test(value)
	) {
		return { start: valueStart, end: valueEnd, replacement: value.replaceAll("'", "''") };
	}

	if (style === SCALAR_STYLE.DOUBLE_QUOTED && typeof value === "string") {
		return { start: valueStart, end: valueEnd, replacement: JSON.stringify(value).slice(1, -1) };
	}

	if (style === SCALAR_STYLE.SINGLE_QUOTED || style === SCALAR_STYLE.DOUBLE_QUOTED) {
		// Widen over the quote characters: the new value needs its own representation.
		return { start: valueStart - 1, end: valueEnd + 1, replacement: renderInline(value) };
	}

	return { start: valueStart, end: valueEnd, replacement: renderInline(value) };
}

/* A key with no value (`tags:`) reports a span of [-1, -1). Insert just after its colon. */
function fillEmptyValue(source, parent, segment, value, selector) {
	let entry = parent.entries.find((item) => keyText(source, item.key) === String(segment));
	let colon = source.indexOf(":", entry.key.event.valueEnd);

	if (colon === -1) {
		throw new DataWriterPreservationError(
			`Cannot write \`${selector}\`: could not locate the \`${segment}\` key’s separator in the source.`,
		);
	}

	return { start: colon + 1, end: colon + 1, replacement: " " + renderInline(value) };
}

/* Indent step used by the document, so synthesized nesting matches what is already there. */
function detectIndentStep(source, root) {
	// -1 stands in for "no parent yet", so the root mapping never looks like a nested one.
	function walk(node, parentIndent) {
		if (node?.type !== "mapping") {
			return undefined;
		}

		for (let entry of node.entries) {
			if (entry.key?.type !== "scalar" || entry.key.event.valueStart < 0) {
				continue;
			}

			let keyIndent = indentAt(source, entry.key.event.valueStart).length;
			if (parentIndent >= 0 && keyIndent > parentIndent) {
				return keyIndent - parentIndent;
			}

			let nested = walk(entry.value, keyIndent);
			if (nested !== undefined) {
				return nested;
			}
		}

		return undefined;
	}

	return walk(root, -1) ?? DEFAULT_INDENT_STEP;
}

/* Where a new key joins `mapping`: the start of the line holding whatever follows the
 * mapping, so comments trailing inside it stay inside it. */
function insertionPoint(source, events, mapping) {
	let next = offsetAfter(events, mapping.popIndex);

	if (next === -1) {
		return source.length;
	}

	return lineStartIndex(source, next);
}

function buildInsertion(source, events, root, parent, remaining, value, selector) {
	if (parent.event?.style === COLLECTION_STYLE.FLOW) {
		throw new DataWriterPreservationError(
			`Cannot write \`${selector}\`: adding a key to a flow mapping (\`{ … }\`) would reformat it.`,
		);
	}

	if (remaining.some((segment) => typeof segment === "number")) {
		throw new DataWriterPreservationError(
			`Cannot write \`${selector}\`: creating a YAML sequence for \`${remaining.join(".")}\` is not yet supported.`,
		);
	}

	let baseIndent = "";
	let firstKey = parent.entries.find(
		(entry) => entry.key?.type === "scalar" && entry.key.event.valueStart >= 0,
	);
	if (firstKey) {
		baseIndent = indentAt(source, firstKey.key.event.valueStart);
	}

	let step = " ".repeat(detectIndentStep(source, root));
	let lines = [];
	for (let [depth, segment] of remaining.entries()) {
		let indent = baseIndent + step.repeat(depth);
		let isLast = depth === remaining.length - 1;
		lines.push(
			`${indent}${renderInline(String(segment))}:${isLast ? " " + renderInline(value) : ""}`,
		);
	}

	let eol = detectEol(source);
	let at = insertionPoint(source, events, parent);
	let needsLeadingNewline = at > 0 && source[at - 1] !== "\n";
	// Only close with a newline when one was already there: a front matter block ends
	// right before its closing delimiter’s newline, so appending one would add a blank line.
	let needsTrailingNewline = at < source.length || source.length === 0 || source.endsWith("\n");
	let replacement =
		(needsLeadingNewline ? eol : "") + lines.join(eol) + (needsTrailingNewline ? eol : "");

	return { start: at, end: at, replacement };
}

/**
 * Computes the smallest span of `source` that must change to set `pathArray` to `value`,
 * preserving every other byte — comments, key order, quoting and indentation included.
 *
 * @param {string} source - YAML document text.
 * @param {Array<string|number>} pathArray - Path to the target, e.g. `["nav", 0, "title"]`.
 * @param {any} value - The new value.
 * @param {object} [options]
 * @param {string} [options.selector] - Original selector string, used in error messages.
 * @returns {{start: number, end: number, replacement: string, previousValue: any, existed: boolean}}
 * @throws {DataWriterPreservationError} When the edit would require reformatting.
 */
function getYamlEdit(source, pathArray, value, options = {}) {
	let selector = options.selector ?? pathArray.join(".");

	if (pathArray.length === 0) {
		throw new DataWriterPreservationError("Cannot write to a YAML document without a selector.");
	}

	let events = parseEvents(source, {});
	let root = buildTree(events);

	let previousValue;
	try {
		previousValue = lodashGet(load(source) ?? {}, pathArray);
	} catch {
		// A document we can’t load still has usable offsets; previousValue stays undefined.
	}

	if (!root || root.type === "scalar") {
		// An empty (or scalar-only) block: everything is synthesized.
		if (root?.type === "scalar" && root.event.valueStart >= 0) {
			throw new DataWriterPreservationError(
				`Cannot write \`${selector}\`: the document is a scalar, not a mapping.`,
			);
		}
		root = { type: "mapping", event: {}, entries: [], popIndex: events.length - 1 };
	}

	if (root.type !== "mapping") {
		throw new DataWriterPreservationError(
			`Cannot write \`${selector}\`: the document is a ${root.type}, not a mapping.`,
		);
	}

	let resolved = resolvePath(source, root, pathArray, selector);

	if (!resolved.found) {
		let edit = buildInsertion(
			source,
			events,
			root,
			resolved.parent,
			resolved.remaining,
			value,
			selector,
		);
		return { ...edit, previousValue, existed: false };
	}

	let { node } = resolved;

	if (node.type === "scalar" && node.event.valueStart < 0) {
		let parentPath = pathArray.slice(0, -1);
		let parent =
			parentPath.length === 0 ? root : resolvePath(source, root, parentPath, selector).node;
		let edit = fillEmptyValue(source, parent, pathArray.at(-1), value, selector);
		return { ...edit, previousValue, existed: false };
	}

	assertReplaceable(node, selector);

	let edit = replaceScalar(source, node, value, selector);
	return { ...edit, previousValue, existed: true };
}

export { getYamlEdit, DataWriterPreservationError, renderInline };
