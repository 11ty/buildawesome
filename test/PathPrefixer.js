import test from "node:test";
import path from "path";

import PathPrefixer from "../src/Util/PathPrefixer.js";

test("joinUrlParts", (t) => {
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a"), "a");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a", "b"), "a/b");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("", "a", "b"), "a/b");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("/a", "b"), "/a/b");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a", "b", "c"), "a/b/c");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a/b", "c/"), "a/b/c/");
});

test("joinUrlParts (Windows)", (t) => {
  // The replace calls are needed, since "\" is a valid path char on unix
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a"), "a");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a\\b".replace(/\\/g, path.sep)), "a/b");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("\\a\\b".replace(/\\/g, path.sep)), "/a/b");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a\\b\\c".replace(/\\/g, path.sep)), "a/b/c");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a\\b".replace(/\\/g, path.sep), "c"), "a/b/c");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a\\b\\c\\".replace(/\\/g, path.sep)), "a/b/c/");
  t.assert.strictEqual(PathPrefixer.joinUrlParts("a\\b/c\\".replace(/\\/g, path.sep)), "a/b/c/");
});

test("normalizePathPrefix", (t) => {
  t.assert.strictEqual(PathPrefixer.normalizePathPrefix("a"), "/a");
  t.assert.strictEqual(PathPrefixer.normalizePathPrefix("a/b"), "/a/b");
  t.assert.strictEqual(PathPrefixer.normalizePathPrefix("/a/b"), "/a/b");
  t.assert.strictEqual(PathPrefixer.normalizePathPrefix("/"), "/");
  t.assert.strictEqual(PathPrefixer.normalizePathPrefix(""), "/");
  t.assert.strictEqual(PathPrefixer.normalizePathPrefix(undefined), "/");
});
