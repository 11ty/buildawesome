import test from "ava";
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";

import { DataWriter, DataWriterError, DataWriterPreservationError } from "../src/DataWriter.js";

// The fixtures are mutated by these tests, so work on a copy. It has to live inside the
// project directory: DataWriter refuses to write outside of it.
const SOURCE_DIR = "./test/stubs";
const WORK_DIR = "./test/stubs-tmp";

test.before(() => {
	deleteDirectory(WORK_DIR);
	cpSync(SOURCE_DIR, WORK_DIR, { recursive: true });
});

test.after.always(() => {
	deleteDirectory(WORK_DIR);
});

function deleteDirectory(dir) {
	if (existsSync(dir)) {
		rmSync(dir, { recursive: true });
	}
}

function read(file) {
	return readFileSync(`${WORK_DIR}/${file}`, "utf8");
}

/* Fixture integrity
 *
 * Every assertion in this file compares exact bytes, so a checkout that rewrote line
 * endings fails most of them at once with confusing diffs. `.gitattributes` marks these
 * fixtures `-text` so Git leaves them alone; this asserts that actually held.
 */
test("Fixtures kept their line endings", (t) => {
	let hasCRLF = (file) => readFileSync(`${SOURCE_DIR}/${file}`, "utf8").includes("\r\n");

	t.false(hasCRLF("commented.md"), "commented.md should be LF");
	t.false(hasCRLF("data.json"), "data.json should be LF");
	t.true(hasCRLF("crlf-fm.md"), "crlf-fm.md should be CRLF");
	t.true(hasCRLF("crlf.json"), "crlf.json should be CRLF");
});

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
	let error = t.throws(() => DataWriter.write(`${WORK_DIR}/data.json`, "pkg", 1), {
		instanceOf: DataWriterError,
	});

	t.regex(error.message, /`pkg` is a reserved data property name/);
});

test("`page` is reserved only for the sub-properties Eleventy supplies", (t) => {
	t.throws(() => DataWriter.write(`${WORK_DIR}/data.json`, "page.url", "/x/"), {
		instanceOf: DataWriterError,
	});

	// `page.custom` is not one of them, so it goes through.
	t.is(DataWriter.write(`${WORK_DIR}/data.json`, "page.custom", 1).written, true);
});

test("The reservedKeys option overrides the default list", (t) => {
	// Opting out entirely, for consumers that are not Eleventy.
	t.is(DataWriter.write(`${WORK_DIR}/data.json`, "pkg", 1, { reservedKeys: [] }).written, true);

	// And a caller can reserve names of its own.
	let error = t.throws(
		() => DataWriter.write(`${WORK_DIR}/data.json`, "mine", 1, { reservedKeys: ["mine"] }),
		{ instanceOf: DataWriterError },
	);
	t.regex(error.message, /`mine` is a reserved data property name/);
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

/* append / prepend */

test("append and prepend add to a JSON array", (t) => {
	DataWriter.write(`${WORK_DIR}/list.json`, "entries", { a: 2 }, { append: true });
	DataWriter.write(`${WORK_DIR}/list.json`, "entries", { a: 0 }, { prepend: true });

	t.deepEqual(JSON.parse(read("list.json")).entries, [{ a: 0 }, { a: 1 }, { a: 2 }]);
});

test("append and prepend add to a YAML sequence", (t) => {
	DataWriter.write(`${WORK_DIR}/list.md`, "entries", "last", { append: true });
	DataWriter.write(`${WORK_DIR}/list.md`, "entries", "first", { prepend: true });

	t.is(read("list.md"), "---\nentries:\n  - first\n  - one\n  - last\n---\nBody\n");
});

test("append creates the array when the key is missing", (t) => {
	DataWriter.write(`${WORK_DIR}/list-new.json`, "entries", "first", { append: true });
	t.deepEqual(JSON.parse(read("list-new.json")).entries, ["first"]);

	DataWriter.write(`${WORK_DIR}/list-new.md`, "entries", "first", { append: true });
	t.regex(read("list-new.md"), /entries: \[first\]/);
});

test("append refuses a flow sequence rather than reformatting it", (t) => {
	t.throws(() => DataWriter.write(`${WORK_DIR}/flow-list.md`, "entries", "c", { append: true }), {
		instanceOf: DataWriterPreservationError,
		message: /flow sequence/,
	});
});

test("append and prepend are mutually exclusive and type-checked", (t) => {
	t.throws(
		() => DataWriter.write(`${WORK_DIR}/list.json`, "entries", 1, { append: true, prepend: true }),
		{ instanceOf: DataWriterError, message: /Only one of/ },
	);

	t.throws(() => DataWriter.write(`${WORK_DIR}/list.json`, "entries[0].a", 1, { append: true }), {
		instanceOf: DataWriterError,
		message: /not an array/,
	});
});

test.serial("A resolver can ask for append", (t) => {
	t.teardown(() => DataWriter.removeStorageKey("guestbook"));

	DataWriter.addStorageKey("guestbook", (data) => ({
		filePath: `${WORK_DIR}/storage-list.json`,
		selector: "entries",
		value: { author: data.author, message: data.body },
		append: true,
	}));

	DataWriter.writeStorage("guestbook", DATA);
	DataWriter.writeStorage("guestbook", { author: "Second", body: "Another" });

	t.deepEqual(JSON.parse(read("storage-list.json")).entries, [
		{ author: "A Visitor", message: "Posted from an entirely different origin." },
		{ author: "Second", message: "Another" },
	]);
});

/* Storage keys
 *
 * An app registers a resolver per storageKey; the resolver owns which file the write lands
 * in, which property it sets, and what the incoming fields become.
 */

const DATA = {
	author: "A Visitor",
	body: "Posted from an entirely different origin.",
};

test.serial("Writes a data object addressed by storageKey", (t) => {
	t.teardown(() => DataWriter.removeStorageKey("guestbook"));

	DataWriter.addStorageKey("guestbook", (data) => ({
		filePath: `${WORK_DIR}/storage.json`,
		selector: "latest",
		// The resolver renames `body` to `message` and adds a field of its own.
		value: { author: data.author, message: data.body, source: "webhook" },
	}));

	let result = DataWriter.writeStorage("guestbook", DATA);

	t.is(result.storageKey, "guestbook");
	t.is(result.selector, "latest");
	t.is(result.written, true);
	t.deepEqual(JSON.parse(read("storage.json")).latest, {
		author: "A Visitor",
		message: "Posted from an entirely different origin.",
		source: "webhook",
	});
});

test.serial("The resolver receives the data object and its key", (t) => {
	t.teardown(() => DataWriter.removeStorageKey("guestbook"));

	let seen;
	DataWriter.addStorageKey("guestbook", (data, storageKey) => {
		seen = { data, storageKey };
		return { filePath: `${WORK_DIR}/storage-args.json`, selector: "a", value: 1 };
	});

	DataWriter.writeStorage("guestbook", DATA);

	t.is(seen.storageKey, "guestbook");
	t.deepEqual(seen.data, DATA);
});

test.serial("Throws for an unregistered storage key", (t) => {
	let error = t.throws(() => DataWriter.writeStorage("not-registered", DATA), {
		instanceOf: DataWriterError,
	});

	t.regex(error.message, /No storage key registered for `not-registered`/);
});

test.serial("A resolver returning nothing refuses the write", (t) => {
	t.teardown(() => DataWriter.removeStorageKey("spam"));

	DataWriter.addStorageKey("spam", () => undefined);

	let error = t.throws(() => DataWriter.writeStorage("spam", DATA), {
		instanceOf: DataWriterError,
	});

	t.regex(error.message, /refused the write/);
});

test.serial("Throws without a storage key or a data object", (t) => {
	t.throws(() => DataWriter.writeStorage("", DATA), {
		instanceOf: DataWriterError,
		message: /non-empty storage key/,
	});

	t.throws(() => DataWriter.writeStorage("guestbook", "not an object"), {
		instanceOf: DataWriterError,
		message: /Expected a data object/,
	});
});

test.serial("Registration is validated, and keys can be listed and cleared", (t) => {
	t.teardown(() => DataWriter.clearStorageKeys());

	t.throws(() => DataWriter.addStorageKey("", () => {}), { instanceOf: DataWriterError });
	t.throws(() => DataWriter.addStorageKey("k", "not a function"), { instanceOf: DataWriterError });

	DataWriter.addStorageKey("k", () => undefined);
	t.deepEqual(DataWriter.getStorageKeys(), ["k"]);

	DataWriter.clearStorageKeys();
	t.deepEqual(DataWriter.getStorageKeys(), []);
});

/* Package entry points */

test("Is exported from the package entry point", async (t) => {
	let pkg = await import("@awesome.me/ba-datawriter");

	t.is(typeof pkg.DataWriter.write, "function");
});
