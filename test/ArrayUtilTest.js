import test from "node:test";
import {arrayDelete} from "../src/Util/ArrayUtil.js";

test("ArrayUtil.arrayDelete empties", async (t) => {
  t.assert.deepStrictEqual(arrayDelete(), []);
  t.assert.deepStrictEqual(arrayDelete(undefined, 1), []);

  t.assert.deepStrictEqual(arrayDelete(null), []);
  t.assert.deepStrictEqual(arrayDelete(1), []);
  t.assert.deepStrictEqual(arrayDelete(true), []);
  t.assert.deepStrictEqual(arrayDelete(false), []);
});

test("ArrayUtil.arrayDelete if array does not have value, it does not mutate", async (t) => {
  let empty = [];
  t.assert.strictEqual(arrayDelete(empty), empty);
  t.assert.strictEqual(arrayDelete(empty, 1), empty);
  t.assert.strictEqual(arrayDelete(empty, true), empty);
  t.assert.strictEqual(arrayDelete(empty, undefined), empty);
});

test("ArrayUtil.arrayDelete if array does not have function matched value, it does not mutate", async (t) => {
  let empty = [];
  t.assert.strictEqual(arrayDelete(empty, () => false), empty);
});


test("ArrayUtil.arrayDelete mutates when array contains match", async (t) => {
  let a = [1, 2];
  t.assert.notStrictEqual(arrayDelete(a, 1), [2]);
  t.assert.deepStrictEqual(arrayDelete(a, 1), [2]);
});

test("ArrayUtil.arrayDelete mutates when array contains function matched value", async (t) => {
  let a = [1, 2];
  t.assert.notStrictEqual(arrayDelete(a, entry => entry === 1), [2]);
  t.assert.deepStrictEqual(arrayDelete(a, entry => entry === 1), [2]);
});

test("ArrayUtil.arrayDelete complex delete", async (t) => {
  let a = [1,2,3,4,5,6,7,8];
  t.assert.deepStrictEqual(arrayDelete(a, 4), [1,2,3,5,6,7,8]);
});

test("ArrayUtil.arrayDelete function matched delete", async (t) => {
  let a = [1,2,3,4,5,6,7,8];
  t.assert.deepStrictEqual(arrayDelete(a, entry => entry === 4), [1,2,3,5,6,7,8]);
});

test("ArrayUtil.arrayDelete double delete", async (t) => {
  let a = [1,2,3,4,5,6,7,8];
  t.assert.deepStrictEqual(arrayDelete(arrayDelete(a, 4), 6), [1,2,3,5,7,8]);
});
