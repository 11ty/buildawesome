import test from "node:test";

import getCollectionItem from "../src/Filters/GetCollectionItem.js";

test("getCollectionItem", (t) => {
  let first = {
    inputPath: "hello.md",
    outputPath: "/hello/",
  };
  let second = {
    inputPath: "hello2.md",
    outputPath: "/hello2/",
  };
  let third = {
    inputPath: "hello3.md",
    outputPath: "/hello3/",
  };
  let collections = [first, second, third];

  t.assert.deepStrictEqual(getCollectionItem(collections, first), first);
  t.assert.deepStrictEqual(getCollectionItem(collections, second), second);
  t.assert.deepStrictEqual(getCollectionItem(collections, third), third);

  t.assert.deepStrictEqual(getCollectionItem(collections, first, -1), undefined);
  t.assert.deepStrictEqual(getCollectionItem(collections, second, -1), first);
  t.assert.deepStrictEqual(getCollectionItem(collections, third, -1), second);

  t.assert.deepStrictEqual(getCollectionItem(collections, first, 1), second);
  t.assert.deepStrictEqual(getCollectionItem(collections, second, 1), third);
  t.assert.deepStrictEqual(getCollectionItem(collections, third, 1), undefined);
});
