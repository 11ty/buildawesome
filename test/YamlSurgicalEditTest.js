import test from "ava";

import { getYamlEdit, DataWriterPreservationError } from "../src/Util/YamlSurgicalEdit.js";

// Applies the returned span edit. Every assertion below compares the exact resulting
// string: re-parsing and deep-comparing would pass even if formatting were destroyed.
function edit(source, pathArray, value) {
	let result = getYamlEdit(source, pathArray, value);
	return source.slice(0, result.start) + result.replacement + source.slice(result.end);
}

function refuses(t, source, pathArray, value, messageMatch) {
	let error = t.throws(() => getYamlEdit(source, pathArray, value), {
		instanceOf: DataWriterPreservationError,
	});
	t.regex(error.message, messageMatch);
}

const COMMENTED = "# a comment above\ntitle: Hello   # inline comment\ncount: 3\n# trailing comment\n";

test("Replaces a plain scalar, leaving comments untouched", (t) => {
	t.is(
		edit(COMMENTED, ["title"], "Goodbye"),
		"# a comment above\ntitle: Goodbye   # inline comment\ncount: 3\n# trailing comment\n",
	);
});

test("Replaces a number", (t) => {
	t.is(
		edit(COMMENTED, ["count"], 7),
		"# a comment above\ntitle: Hello   # inline comment\ncount: 7\n# trailing comment\n",
	);
});

test("Single quoted scalars keep their quoting style, escaping inner quotes", (t) => {
	t.is(edit("a: 'single'\n", ["a"], "it's here"), "a: 'it''s here'\n");
});

test("Double quoted scalars keep their quoting style", (t) => {
	t.is(edit('b: "double"\n', ["b"], 'say "hi"'), 'b: "say \\"hi\\""\n');
});

test("A non-string value widens the span over the quote characters", (t) => {
	t.is(edit('b: "double"\n', ["b"], 42), "b: 42\n");
});

test("A plain scalar gains quotes when the new value needs them", (t) => {
	// `yes` would otherwise read back as a boolean.
	t.is(edit("c: plain\n", ["c"], "yes"), "c: 'yes'\n");
});

test("An object replacing a scalar renders inline, so nothing is re-indented", (t) => {
	t.is(edit("c: plain\n", ["c"], { x: 1, z: [1, 2] }), "c: {x: 1, z: [1, 2]}\n");
});

test("Inserts a new top level key after a trailing comment", (t) => {
	t.is(
		edit(COMMENTED, ["newkey"], "v"),
		"# a comment above\ntitle: Hello   # inline comment\ncount: 3\n# trailing comment\nnewkey: v\n",
	);
});

const NESTED = "seo:\n  title: A\n  tags:\n    - one\n    - two\nother: z\n";

test("Replaces a nested scalar", (t) => {
	t.is(edit(NESTED, ["seo", "title"], "B"), "seo:\n  title: B\n  tags:\n    - one\n    - two\nother: z\n");
});

test("Replaces a sequence item by index", (t) => {
	t.is(edit(NESTED, ["seo", "tags", 1], "TWO"), "seo:\n  title: A\n  tags:\n    - one\n    - TWO\nother: z\n");
});

test("Inserts into an existing nested mapping at the right indent", (t) => {
	t.is(
		edit(NESTED, ["seo", "desc"], "D"),
		"seo:\n  title: A\n  tags:\n    - one\n    - two\n  desc: D\nother: z\n",
	);
});

test("Synthesizes missing intermediate mappings", (t) => {
	t.is(edit("title: A\n", ["seo", "og", "image"], "x.png"), "title: A\nseo:\n  og:\n    image: x.png\n");
});

test("Synthesized nesting matches the document’s own indent step", (t) => {
	t.is(
		edit("seo:\n    title: A\nother: 1\n", ["seo", "desc"], "D"),
		"seo:\n    title: A\n    desc: D\nother: 1\n",
	);
});

test("A block scalar keeps its indicator, indent and chomping", (t) => {
	t.is(
		edit("lit: |\n  line one\n  line two\nafter: x\n", ["lit"], "new one\nnew two"),
		"lit: |\n  new one\n  new two\nafter: x\n",
	);
});

test("A key with no value is filled in after its colon", (t) => {
	t.is(edit("empty:\nafter: 1\n", ["empty"], "now-set"), "empty: now-set\nafter: 1\n");
});

test("Replaces a scalar inside a flow mapping", (t) => {
	t.is(edit("m: {a: 1, b: 2}\n", ["m", "a"], 9), "m: {a: 9, b: 2}\n");
});

test("Insertions use the document’s line endings", (t) => {
	t.is(edit("title: Hello\r\ncount: 3\r\n", ["extra"], "v"), "title: Hello\r\ncount: 3\r\nextra: v\r\n");
});

test("Insertion into an empty document synthesizes the whole path", (t) => {
	t.is(edit("", ["a", "b"], 1), "a:\n  b: 1\n");
});

test("Reports the previous value and whether the key existed", (t) => {
	t.deepEqual(
		(({ previousValue, existed }) => ({ previousValue, existed }))(
			getYamlEdit("a: 1\n", ["a"], 2),
		),
		{ previousValue: 1, existed: true },
	);
	t.deepEqual(
		(({ previousValue, existed }) => ({ previousValue, existed }))(
			getYamlEdit("a: 1\n", ["b"], 2),
		),
		{ previousValue: undefined, existed: false },
	);
});

/* Refusals: the contract is surgical-or-throw, never reformat. */

const ANCHORS = "defaults: &d\n  a: 1\nuse:\n  <<: *d\n  b: 2\nref: *d\n";

test("Refuses to write through a merge key", (t) => {
	refuses(t, ANCHORS, ["use", "b"], 9, /merge key/);
});

test("Refuses to write an alias", (t) => {
	refuses(t, ANCHORS, ["ref"], 9, /alias/);
});

test("Refuses to replace a collection wholesale", (t) => {
	refuses(t, NESTED, ["seo"], { a: 1 }, /replacing a collection wholesale/);
});

test("Refuses to insert into a flow mapping", (t) => {
	refuses(t, "m: {a: 1, b: 2}\n", ["m", "c"], 9, /flow mapping/);
});

test("Refuses an ambiguous duplicate key", (t) => {
	refuses(t, "k: 1\nk: 2\n", ["k"], 3, /appears 2 times/);
});

test("Refuses to overwrite a tagged node", (t) => {
	refuses(t, "num: !!str 123\n", ["num"], 5, /explicit YAML tag/);
});

test("Refuses to replace a block scalar with a non-string", (t) => {
	refuses(t, "lit: |\n  a\n", ["lit"], 5, /block scalar/);
});

test("Refuses to append past the end of a sequence", (t) => {
	refuses(t, "tags:\n  - one\n", ["tags", 5], "x", /not yet supported/);
});

test("Refuses to index into a scalar", (t) => {
	refuses(t, "a: 1\n", ["a", "b"], 2, /is a scalar/);
});
