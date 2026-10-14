import test from "ava";
import { union } from "../src/Util/SetUtil.js";

test("Basic set union (zero)", t => {
  t.deepEqual(union(), new Set());
});

test("Basic set union (one)", t => {
  let a = new Set([1,2,3]);
  t.deepEqual(union(a), new Set([1,2,3]));
});

test("Basic set union (two)", t => {
  let a = new Set([1,2,3]);
  let b = new Set([3,4,5]);
  t.deepEqual(union(a, b), new Set([1,2,3,4,5]));
});

test("Basic set union (three)", t => {
  let a = new Set([0,1,2,3]);
  let b = new Set([3,4,5]);
  let c = new Set([3,4,5,6]);
  t.deepEqual(union(a, b, c), new Set([0,1,2,3,4,5,6]));
});
