import test from "node:test";
import getCollectionItemIndex from "../src/Filters/GetCollectionItemIndex.js";

test("getCollectionItemIndex", (t) => {
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

  t.assert.deepStrictEqual(getCollectionItemIndex(collections, first), 0);
  t.assert.deepStrictEqual(getCollectionItemIndex(collections, second), 1);
  t.assert.deepStrictEqual(getCollectionItemIndex(collections, third), 2);

  t.assert.deepStrictEqual(
    getCollectionItemIndex(collections, {
      inputPath: "unknown.md",
      outputPath: "/unknown/",
    }),
    undefined
  );
});
