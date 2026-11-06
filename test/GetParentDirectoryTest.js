import test from "node:test";
import getParentDirectory from "../src/Filters/GetParentDirectory.js";

test("Directory paths - returns parent directory", (t) => {
	// Examples from issue #3794
	t.assert.strictEqual(getParentDirectory("/mydir/"), "/");

	// Nested directories
	t.assert.strictEqual(getParentDirectory("/a/b/"), "/a/");
	t.assert.strictEqual(getParentDirectory("/a/b/c/"), "/a/b/");
	t.assert.strictEqual(getParentDirectory("/a/b/c/d/"), "/a/b/c/");
});

test("File paths - returns containing directory", (t) => {
	// Examples from issue #3794
	t.assert.strictEqual(getParentDirectory("/mydir/slug.html"), "/mydir/");
	t.assert.strictEqual(getParentDirectory("/mydir/index.md"), "/mydir/");

	// Nested file paths
	t.assert.strictEqual(getParentDirectory("/a/b/file.html"), "/a/b/");
	t.assert.strictEqual(getParentDirectory("/a/b/c/page.md"), "/a/b/c/");
});

test("Root level paths", (t) => {
	// Root directory
	t.assert.strictEqual(getParentDirectory("/"), "/");

	// File at root
	t.assert.strictEqual(getParentDirectory("/file.html"), "/");
	t.assert.strictEqual(getParentDirectory("/index.md"), "/");
});

test("Edge cases", (t) => {
	// Empty and invalid inputs
	t.assert.strictEqual(getParentDirectory(""), undefined);
	t.assert.strictEqual(getParentDirectory(null), undefined);
	t.assert.strictEqual(getParentDirectory(undefined), undefined);

	// Non-string inputs
	t.assert.strictEqual(getParentDirectory(123), undefined);
	t.assert.strictEqual(getParentDirectory({}), undefined);

	// Relative paths (no leading slash)
	t.assert.strictEqual(getParentDirectory("file.html"), undefined);
	t.assert.strictEqual(getParentDirectory("dir/file.html"), "dir/");
	t.assert.strictEqual(getParentDirectory("a/b/c/"), "a/b/");
});

test("Single segment paths", (t) => {
	// Directory with single segment
	t.assert.strictEqual(getParentDirectory("/foo/"), "/");

	// File with single segment at root
	t.assert.strictEqual(getParentDirectory("/foo"), "/");
});

test("Relative paths without a parent", (t) => {
	t.assert.strictEqual(getParentDirectory("dir/"), undefined);
	t.assert.strictEqual(getParentDirectory("./"), undefined);
	t.assert.strictEqual(getParentDirectory("../"), undefined);
});

test("Full URLs keep their origin", (t) => {
	t.assert.strictEqual(getParentDirectory("https://example.com"), "https://example.com/");
	t.assert.strictEqual(getParentDirectory("https://example.com/"), "https://example.com/");
	t.assert.strictEqual(getParentDirectory("https://example.com/a/"), "https://example.com/");
	t.assert.strictEqual(getParentDirectory("https://example.com/a/b.html"), "https://example.com/a/");
	t.assert.strictEqual(getParentDirectory("https://example.com/a/b/?x=1#y"), "https://example.com/a/");
});

test("page.inputPath values", (t) => {
	t.assert.strictEqual(getParentDirectory("./src/blog/post.md"), "./src/blog/");
	t.assert.strictEqual(getParentDirectory("./index.md"), "./");
	t.assert.strictEqual(getParentDirectory("../content/a.md"), "../content/");
});

test("Paths are returned as an exact, unencoded prefix", (t) => {
	t.assert.strictEqual(getParentDirectory("/my dir/é/page.html"), "/my dir/é/");
	t.assert.strictEqual(getParentDirectory("/100%-off/a.html"), "/100%-off/");
	t.assert.strictEqual(getParentDirectory("/a%20b/c.html"), "/a%20b/");
	t.assert.strictEqual(getParentDirectory("/what?/"), "/");
	t.assert.strictEqual(getParentDirectory("./src/c#/intro.md"), "./src/c#/");
});

test("String objects", (t) => {
	t.assert.strictEqual(getParentDirectory(new String("/a/b/")), "/a/");
});
