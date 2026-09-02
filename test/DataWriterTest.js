import test from "ava";
import { cpSync, existsSync, readFileSync } from "node:fs";

import { DataWriter, DataWriterError, DataWriterPreservationError } from "../src/Data/DataWriter.js";
import { deleteDirectory } from "./_testHelpers.js";

// The fixtures are mutated by these tests, so work on a copy. It has to live inside the
// project directory: DataWriter refuses to write outside of it.
const SOURCE_DIR = "./test/stubs-datawriter";
const WORK_DIR = "./test/stubs-datawriter-tmp";

test.before(() => {
	deleteDirectory(WORK_DIR);
	cpSync(SOURCE_DIR, WORK_DIR, { recursive: true });
});

test.after.always(() => {
	deleteDirectory(WORK_DIR);
});

function read(file) {
	return readFileSync(`${WORK_DIR}/${file}`, "utf8");
}

/* JSON data files */

test("Writes into a JSON file without disturbing anything else", (t) => {
	let result = DataWriter.write(`${WORK_DIR}/data.json`, "b.c", 99);

	t.is(result.written, true);
	t.is(result.created, false);
	t.is(result.previousValue, 2);
	// The blank line, the inline object and the key order all survive.
	t.is(read("data.json"), '{\n  "a": 1,\n\n  "b": {"c": 99},\n  "nav": [{"title": "Home"}]\n}\n');
});

test("Addresses an array element by index", (t) => {
	DataWriter.write(`${WORK_DIR}/data.json`, "nav[0].title", "Away");

	t.regex(read("data.json"), /"nav": \[\{"title": "Away"\}\]/);
});

test("Preserves tab indentation", (t) => {
	DataWriter.write(`${WORK_DIR}/tabs.json`, "a", 2);

	t.is(read("tabs.json"), '{\n\t"a": 2\n}\n');
});

test("Preserves CRLF line endings", (t) => {
	DataWriter.write(`${WORK_DIR}/crlf.json`, "a", 2);

	t.is(read("crlf.json"), '{\r\n  "a": 2\r\n}\r\n');
});

test("An unchanged value does not touch the file", (t) => {
	let before = read("data.json");
	let result = DataWriter.write(`${WORK_DIR}/data.json`, "a", 1);

	t.is(result.written, false);
	t.is(result.previousValue, 1);
	t.is(read("data.json"), before);
});

test("Creates a missing JSON file", (t) => {
	let result = DataWriter.write(`${WORK_DIR}/created.json`, "nav[0].title", "Home");

	t.is(result.created, true);
	t.is(read("created.json"), '{\n  "nav": [\n    {\n      "title": "Home"\n    }\n  ]\n}\n');
});

/* Front matter */

test("Writes YAML front matter, leaving comments and the body byte-identical", (t) => {
	let result = DataWriter.write(`${WORK_DIR}/commented.md`, "title", "Goodbye");

	t.is(result.previousValue, "Hello");
	t.is(
		read("commented.md"),
		"---\n# a comment above\ntitle: Goodbye   # inline comment\ncount: 3\n# trailing comment\n---\nBody text\n",
	);
});

test("Inserts a new front matter key without adding a blank line", (t) => {
	DataWriter.write(`${WORK_DIR}/nested.md`, "draft", true);

	t.is(
		read("nested.md"),
		"---\nseo:\n  title: A\n  tags:\n    - one\n    - two\nother: z\ndraft: true\n---\nBody\n",
	);
});

test("JSON front matter keeps its language tag", (t) => {
	// gray-matter’s own stringify() drops the tag, which would stop the block re-parsing
	// as JSON. This is the regression guard for locating and splicing instead.
	let result = DataWriter.write(`${WORK_DIR}/json-fm.md`, "key1", "changed");

	t.is(result.previousValue, "value1");
	t.is(read("json-fm.md"), '---json\n{\n  "key1": "changed",\n  "key2": "value2"\n}\n---\nBody\n');
});

test("Preserves CRLF in front matter", (t) => {
	DataWriter.write(`${WORK_DIR}/crlf-fm.md`, "count", 4);

	t.is(read("crlf-fm.md"), "---\r\ntitle: Hello\r\ncount: 4\r\n---\r\nBody\r\n");
});

test("Prepends a block to a file that has no front matter", (t) => {
	let result = DataWriter.write(`${WORK_DIR}/body-only.md`, "title", "Hi");

	t.is(result.created, true);
	t.is(read("body-only.md"), "---\ntitle: Hi\n---\nJust a body, no front matter.\n");
});

test("Creates a missing template with front matter and an empty body", (t) => {
	let result = DataWriter.write(`${WORK_DIR}/created.md`, "title", "Fresh");

	t.is(result.created, true);
	t.is(read("created.md"), "---\ntitle: Fresh\n---\n");
});

test("The format option chooses the language for a new block", (t) => {
	DataWriter.write(`${WORK_DIR}/created-json.md`, "title", "Hi", { format: "json" });

	t.is(read("created-json.md"), '---json\n{\n  "title": "Hi"\n}\n---\n');
});

/* Reserved modes: these flip when the planned modes land */

test("Refuses JS and TS data files, naming the extension", (t) => {
	let error = t.throws(() => DataWriter.write(`${WORK_DIR}/reserved.11tydata.js`, "a", 2), {
		instanceOf: DataWriterError,
	});

	t.regex(error.message, /`\.js` data files is not yet supported/);
	// It must not fall through to the front matter branch.
	t.is(read("reserved.11tydata.js"), "export default { a: 1 };\n");
});

test("Refuses js front matter, naming the language", (t) => {
	let error = t.throws(() => DataWriter.write(`${WORK_DIR}/js-fm.md`, "a", 2), {
		instanceOf: DataWriterError,
	});

	t.regex(error.message, /`js` front matter is not yet supported/);
});

test("Refuses toml front matter, naming the language", (t) => {
	let error = t.throws(() => DataWriter.write(`${WORK_DIR}/toml-fm.md`, "front", "bye"), {
		instanceOf: DataWriterError,
	});

	t.regex(error.message, /`toml` front matter is not yet supported/);
});

/* Safety */

test("Refuses a reserved data key", (t) => {
	let error = t.throws(() => DataWriter.write(`${WORK_DIR}/data.json`, "pkg", 1));

	t.regex(error.message, /reserved data property names/);
});

test("Refuses a write outside the project directory", (t) => {
	let error = t.throws(() => DataWriter.write("../outside.json", "a", 1), {
		instanceOf: DataWriterError,
	});

	t.regex(error.message, /outside of the project directory/);
	t.false(existsSync("../outside.json"));
});

test("Surfaces a preservation refusal from the YAML editor", (t) => {
	t.throws(() => DataWriter.write(`${WORK_DIR}/anchors.md`, "ref", 2), {
		instanceOf: DataWriterPreservationError,
	});
});

/* Package entry points */

test("Is exported from the ./datawriter subpath", async (t) => {
	let subpath = await import("@11ty/eleventy/datawriter");

	t.is(typeof subpath.DataWriter.write, "function");
});
