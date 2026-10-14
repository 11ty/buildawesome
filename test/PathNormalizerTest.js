import test from "ava";
import path from "path";

import PathNormalizer from "../src/Util/PathNormalizer.js";

test("normalizeSeparator", (t) => {
  t.is(PathNormalizer.normalizeSeperator("."), ".");
  t.is(PathNormalizer.normalizeSeperator("a/b"), "a/b");
  t.is(PathNormalizer.normalizeSeperator("a\\b").replace(/\\/g, path.sep), "a/b");
  t.is(PathNormalizer.normalizeSeperator("a\\b/c").replace(/\\/g, path.sep), "a/b/c");
  t.is(PathNormalizer.normalizeSeperator(undefined), undefined);
});

test("getParts", (t) => {
  t.deepEqual(PathNormalizer.getParts("."), []);
  t.deepEqual(PathNormalizer.getParts("test/a/b"), ["test", "a", "b"]);
  t.deepEqual(PathNormalizer.getParts("test\\a\\b".replace(/\\/g, path.sep)), ["test", "a", "b"]);
});

test("getAllPaths", (t) => {
  t.deepEqual(PathNormalizer.getAllPaths("."), []);
  t.deepEqual(PathNormalizer.getAllPaths("test/a/b"), ["test", "test/a", "test/a/b"]);
  t.deepEqual(PathNormalizer.getAllPaths("test/a/b.liquid"), ["test", "test/a", "test/a/b.liquid"]);
});
