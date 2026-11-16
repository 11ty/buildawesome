import test from "node:test";
import getCollectionItemIndex from "../src/Filters/GetCollectionItemIndex.js";

let noI18nConfig = {
  getFilter: () => undefined,
};

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

  t.assert.deepStrictEqual(getCollectionItemIndex(noI18nConfig, collections, first), 0);
  t.assert.deepStrictEqual(getCollectionItemIndex(noI18nConfig, collections, second), 1);
  t.assert.deepStrictEqual(getCollectionItemIndex(noI18nConfig, collections, third), 2);

  t.assert.deepStrictEqual(
    getCollectionItemIndex(noI18nConfig, collections, {
      inputPath: "unknown.md",
      outputPath: "/unknown/",
    }),
    undefined
  );
});
