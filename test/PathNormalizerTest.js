import test from "node:test";
import path from "path";

import PathNormalizer from "../src/Util/PathNormalizer.js";

test("normalizeSeparator", (t) => {
  t.assert.strictEqual(PathNormalizer.normalizeSeperator("."), ".");
  t.assert.strictEqual(PathNormalizer.normalizeSeperator("a/b"), "a/b");
  t.assert.strictEqual(PathNormalizer.normalizeSeperator("a\\b").replace(/\\/g, path.sep), "a/b");
  t.assert.strictEqual(PathNormalizer.normalizeSeperator("a\\b/c").replace(/\\/g, path.sep), "a/b/c");
  t.assert.strictEqual(PathNormalizer.normalizeSeperator(undefined), undefined);
});

test("getParts", (t) => {
  t.assert.deepStrictEqual(PathNormalizer.getParts("."), []);
  t.assert.deepStrictEqual(PathNormalizer.getParts("test/a/b"), ["test", "a", "b"]);
  t.assert.deepStrictEqual(PathNormalizer.getParts("test\\a\\b".replace(/\\/g, path.sep)), ["test", "a", "b"]);
});

test("getAllPaths", (t) => {
  t.assert.deepStrictEqual(PathNormalizer.getAllPaths("."), []);
  t.assert.deepStrictEqual(PathNormalizer.getAllPaths("test/a/b"), ["test", "test/a", "test/a/b"]);
  t.assert.deepStrictEqual(PathNormalizer.getAllPaths("test/a/b.liquid"), ["test", "test/a", "test/a/b.liquid"]);
});
