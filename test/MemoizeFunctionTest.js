import test from "node:test";
import memoize from "../src/Util/MemoizeFunction.js";

test("Memoizes a single-arg function", async (t) => {
  let calls = 0;
  let fn = memoize((str) => `${str}${++calls}`);
  t.assert.strictEqual(fn("a"), "a1");
  t.assert.strictEqual(fn("a"), "a1");
  t.assert.strictEqual(fn("b"), "b2");
});

test("Skips memoization for multiple args without getCacheKey", async (t) => {
  let calls = 0;
  let fn = memoize(() => ++calls);
  fn("a", "b");
  fn("a", "b");
  t.assert.strictEqual(calls, 2);
});

test("getCacheKey supports multiple args", async (t) => {
  let calls = 0;
  let fn = memoize((a, b) => `${a}${b}${++calls}`, { getCacheKey: (a, b) => `${a}:${b}` });
  t.assert.strictEqual(fn("a", "b"), "ab1");
  t.assert.strictEqual(fn("a", "b"), "ab1");
  t.assert.strictEqual(fn("a", "c"), "ac2");
});

test("clear() empties the cache", async (t) => {
  let calls = 0;
  let fn = memoize(() => ++calls);
  fn("a");
  fn.clear();
  fn("a");
  t.assert.strictEqual(calls, 2);
});

test("Rejected promises are not cached", async (t) => {
  let calls = 0;
  let fn = memoize(async () => {
    calls++;
    if (calls === 1) {
      throw new Error("Failed");
    }
    return "ok";
  });

  await t.assert.rejects(fn("a"));
  t.assert.strictEqual(await fn("a"), "ok");
  t.assert.strictEqual(await fn("a"), "ok");
  t.assert.strictEqual(calls, 2);
});
