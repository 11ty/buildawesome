import test from "ava";
import getParentDirectory from "../src/Filters/GetParentDirectory.js";

test("Directory paths - returns parent directory", (t) => {
	// Examples from issue #3794
	t.is(getParentDirectory("/mydir/"), "/");

	// Nested directories
	t.is(getParentDirectory("/a/b/"), "/a/");
	t.is(getParentDirectory("/a/b/c/"), "/a/b/");
	t.is(getParentDirectory("/a/b/c/d/"), "/a/b/c/");
});

test("File paths - returns containing directory", (t) => {
	// Examples from issue #3794
	t.is(getParentDirectory("/mydir/slug.html"), "/mydir/");
	t.is(getParentDirectory("/mydir/index.md"), "/mydir/");

	// Nested file paths
	t.is(getParentDirectory("/a/b/file.html"), "/a/b/");
	t.is(getParentDirectory("/a/b/c/page.md"), "/a/b/c/");
});

test("Root level paths", (t) => {
	// Root directory
	t.is(getParentDirectory("/"), "/");

	// File at root
	t.is(getParentDirectory("/file.html"), "/");
	t.is(getParentDirectory("/index.md"), "/");
});

test("Edge cases", (t) => {
	// Empty and invalid inputs
	t.is(getParentDirectory(""), "");
	t.is(getParentDirectory(null), "");
	t.is(getParentDirectory(undefined), "");

	// Non-string inputs
	t.is(getParentDirectory(123), "");
	t.is(getParentDirectory({}), "");

	// Relative paths (no leading slash)
	t.is(getParentDirectory("file.html"), "");
	t.is(getParentDirectory("dir/file.html"), "dir/");
	t.is(getParentDirectory("a/b/c/"), "a/b/");
});

test("Single segment paths", (t) => {
	// Directory with single segment
	t.is(getParentDirectory("/foo/"), "/");

	// File with single segment at root
	t.is(getParentDirectory("/foo"), "/");
});
