import test from "node:test";
import GlobalDependencyMap from "../src/GlobalDependencyMap.js";

test("Test map", (t) => {
  let map = new GlobalDependencyMap();
  map.addDependency("test.njk", ["_includes/include.njk"]);
  t.assert.strictEqual(map.hasDependency("test.njk", "_includes/include.njk"), true);
  t.assert.strictEqual(map.hasDependency("test.njk", "_includes/other.njk"), false);

  t.assert.strictEqual(map.isFileRelevantTo("test.njk", null), false);
  t.assert.strictEqual(map.isFileRelevantTo("test.njk", "test.njk"), true);

  // if _includes/include.njk changes, we want to recompile test.njk
  t.assert.strictEqual(map.isFileRelevantTo("test.njk", "_includes/include.njk"), true);
  t.assert.strictEqual(map.isFileRelevantTo("_includes/include.njk", "test.njk"), false);
});

test("Normalize nodes (remove leading dot slash)", (t) => {
  let map = new GlobalDependencyMap();
  map.addDependency("./test.njk", ["./_includes/include.njk"]);
  t.assert.strictEqual(map.hasDependency("./test.njk", "./_includes/include.njk"), true);
  t.assert.strictEqual(map.hasDependency("./test.njk", "./_includes/other.njk"), false);

  t.assert.strictEqual(map.isFileRelevantTo("./test.njk", "./_includes/include.njk"), true);
  t.assert.strictEqual(map.isFileRelevantTo("./_includes/include.njk", "./test.njk"), false);
});

test("Layouts", (t) => {
  let map = new GlobalDependencyMap();
  map.addDependency("test.njk", ["_includes/include.njk"]);
  map.addLayoutsToMap({
    "./_includes/layout.njk": ["./test.njk"],
  });

  // if _layout/layout.njk changes, we want to write test.njk
  t.assert.strictEqual(map.isFileRelevantTo("test.njk", "_includes/layout.njk"), true);
  t.assert.strictEqual(map.isFileRelevantTo("_includes/layout.njk", "test.njk"), false);

  t.assert.strictEqual(map.isFileRelevantTo("_includes/layout.njk", "_includes/include.njk"), false);
  t.assert.strictEqual(map.isFileRelevantTo("_includes/include.njk", "_includes/layout.njk"), false);

  // if _layout/layout.njk changes, we don’t care about recompiling test.njk (ignore layouts)
  // though we do want to re-write test.njk so we want incremental to match
  t.assert.strictEqual(map.isFileRelevantTo("test.njk", "_includes/layout.njk", false), false);
  t.assert.strictEqual(map.isFileRelevantTo("_includes/layout.njk", "test.njk", false), false);

  t.assert.strictEqual(map.isFileRelevantTo("_includes/layout.njk", "_includes/include.njk", false), false);
  t.assert.strictEqual(map.isFileRelevantTo("_includes/include.njk", "_includes/layout.njk", false), false);
});

test("Stringify/restore", (t) => {
  let origin = new GlobalDependencyMap();
  origin.addDependency("test.njk", ["_includes/include.njk"]);

  t.assert.strictEqual(
    origin.stringify(),
    `{"nodes":{"__collection:all":"__collection:all","__collection:[keys]":"__collection:[keys]","__collection:[userconfig]":"__collection:[userconfig]","__collection:[basic]":"__collection:[basic]","test.njk":"test.njk","_includes/include.njk":"_includes/include.njk"},"outgoingEdges":{"__collection:all":["__collection:[keys]"],"__collection:[keys]":["__collection:[userconfig]"],"__collection:[userconfig]":["__collection:[basic]"],"__collection:[basic]":[],"test.njk":["_includes/include.njk"],"_includes/include.njk":[]},"incomingEdges":{"__collection:all":[],"__collection:[keys]":["__collection:all"],"__collection:[userconfig]":["__collection:[keys]"],"__collection:[basic]":["__collection:[userconfig]"],"test.njk":[],"_includes/include.njk":["test.njk"]},"circular":true}`
  );

  let map = new GlobalDependencyMap();
  map.restore(origin.stringify());

  t.assert.strictEqual(map.hasDependency("test.njk", "_includes/include.njk"), true);
  t.assert.strictEqual(map.hasDependency("test.njk", "_includes/other.njk"), false);

  t.assert.strictEqual(map.isFileRelevantTo("test.njk", null), false);
  t.assert.strictEqual(map.isFileRelevantTo("test.njk", "test.njk"), true);

  // if _includes/include.njk changes, we want to recompile test.njk
  t.assert.strictEqual(map.isFileRelevantTo("test.njk", "_includes/include.njk"), true);
  t.assert.strictEqual(map.isFileRelevantTo("_includes/include.njk", "test.njk"), false);
});

test("Collection API", (t) => {
  let map = new GlobalDependencyMap();

  map.setCollectionApiNames(["articles"]);
  map.initializeUserConfigurationApiCollections();
  map.addNewNodeRelationships("test.njk", [], ["all"])
  map.addNewNodeRelationships("feed.njk", ["articles"], ["all"])

  t.assert.deepStrictEqual(map.getTemplateOrder(), [
    "test.njk",
    "__collection:articles",
    "feed.njk",
    "__collection:[keys]",
    "__collection:all",
  ]);
});
