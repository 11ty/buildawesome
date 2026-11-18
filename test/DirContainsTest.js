import test from "node:test";
import DirContains from "../src/Util/DirContains.js";

test("Compare to current dir", (t) => {
  t.assert.strictEqual(DirContains(".", "."), true);
  t.assert.strictEqual(DirContains(".", ".."), false);
  t.assert.strictEqual(DirContains(".", "test"), true);
  t.assert.strictEqual(DirContains(".", "./test"), true);
  t.assert.strictEqual(DirContains(".", "../test"), false);
});

test("Compare to parent dir", (t) => {
  t.assert.strictEqual(DirContains("..", "."), true);
  t.assert.strictEqual(DirContains("..", ".."), true);
  t.assert.strictEqual(DirContains("..", "../.."), false);
  t.assert.strictEqual(DirContains("..", "test"), true);
  t.assert.strictEqual(DirContains("..", "./test"), true);
  t.assert.strictEqual(DirContains("..", "../test"), true);
});

test("Compare to subfolder", (t) => {
  t.assert.strictEqual(DirContains("test", "."), false);
  t.assert.strictEqual(DirContains("test", ".."), false);
  t.assert.strictEqual(DirContains("test", "../.."), false);
  t.assert.strictEqual(DirContains("test", "test"), true);
  t.assert.strictEqual(DirContains("test", "./test"), true);
  t.assert.strictEqual(DirContains("test", "../test"), false);
});

test("Compare to subfolder dot slash", (t) => {
  t.assert.strictEqual(DirContains("./test", "."), false);
  t.assert.strictEqual(DirContains("./test", ".."), false);
  t.assert.strictEqual(DirContains("./test", "../.."), false);
  t.assert.strictEqual(DirContains("./test", "test"), true);
  t.assert.strictEqual(DirContains("./test", "./test"), true);
  t.assert.strictEqual(DirContains("./test", "../test"), false);
});

test("Compare to sibling folder", (t) => {
  t.assert.strictEqual(DirContains("../test", "."), false);
  t.assert.strictEqual(DirContains("../test", ".."), false);
  t.assert.strictEqual(DirContains("../test", "../.."), false);
  t.assert.strictEqual(DirContains("../test", "test"), false);
  t.assert.strictEqual(DirContains("../test", "./test"), false);
  t.assert.strictEqual(DirContains("../test", "../test"), true);
  t.assert.strictEqual(DirContains("../test", "../test/sub1"), true);
});

test("Sibling folder sharing a name prefix", (t) => {
  t.assert.strictEqual(DirContains("_site", "_site-extra/a.txt"), false);
  t.assert.strictEqual(DirContains("_site", "_site-extra"), false);
  t.assert.strictEqual(DirContains("_site", "_site/a.txt"), true);
  t.assert.strictEqual(DirContains("_site/", "_site/a.txt"), true);
  t.assert.strictEqual(DirContains("_site", "_site/..a.txt"), true);
});
