import test from "ava";
import {arrayDelete} from "../src/Util/ArrayUtil.js";

test("ArrayUtil.arrayDelete empties", async (t) => {
  t.deepEqual(arrayDelete(), []);
  t.deepEqual(arrayDelete(undefined, 1), []);

  t.deepEqual(arrayDelete(null), []);
  t.deepEqual(arrayDelete(1), []);
  t.deepEqual(arrayDelete(true), []);
  t.deepEqual(arrayDelete(false), []);
});

test("ArrayUtil.arrayDelete if array does not have value, it does not mutate", async (t) => {
  let empty = [];
  t.is(arrayDelete(empty), empty);
  t.is(arrayDelete(empty, 1), empty);
  t.is(arrayDelete(empty, true), empty);
  t.is(arrayDelete(empty, undefined), empty);
});

test("ArrayUtil.arrayDelete if array does not have function matched value, it does not mutate", async (t) => {
  let empty = [];
  t.is(arrayDelete(empty, () => false), empty);
});


test("ArrayUtil.arrayDelete mutates when array contains match", async (t) => {
  let a = [1, 2];
  t.not(arrayDelete(a, 1), [2]);
  t.deepEqual(arrayDelete(a, 1), [2]);
});

test("ArrayUtil.arrayDelete mutates when array contains function matched value", async (t) => {
  let a = [1, 2];
  t.not(arrayDelete(a, entry => entry === 1), [2]);
  t.deepEqual(arrayDelete(a, entry => entry === 1), [2]);
});

test("ArrayUtil.arrayDelete complex delete", async (t) => {
  let a = [1,2,3,4,5,6,7,8];
  t.deepEqual(arrayDelete(a, 4), [1,2,3,5,6,7,8]);
});

test("ArrayUtil.arrayDelete function matched delete", async (t) => {
  let a = [1,2,3,4,5,6,7,8];
  t.deepEqual(arrayDelete(a, entry => entry === 4), [1,2,3,5,6,7,8]);
});

test("ArrayUtil.arrayDelete double delete", async (t) => {
  let a = [1,2,3,4,5,6,7,8];
  t.deepEqual(arrayDelete(arrayDelete(a, 4), 6), [1,2,3,5,7,8]);
});
