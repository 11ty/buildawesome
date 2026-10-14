import test from "ava";
import Benchmark from "../src/Benchmark/Benchmark.js";

test("Standard Benchmark", async (t) => {
  await new Promise((resolve) => {
    let b = new Benchmark();
    b.before();
    setTimeout(function () {
      b.after();
      t.truthy(b.getTotal() >= 0);
      resolve();
    }, 100);
  });
});

test("Nested Benchmark (nested calls are ignored while a parent is measuring)", async (t) => {
  await new Promise((resolve) => {
    let b = new Benchmark();
    b.before();

    setTimeout(function () {
      b.before();
      b.after();
      t.truthy(b.getTotal() <= 0.1);

      b.after();
      t.truthy(b.getTotal() >= 10);
      resolve();
    }, 100);
  });
});

test("Reset Benchmark", async (t) => {
  await new Promise((resolve) => {
    let b = new Benchmark();
    b.before();
    b.reset();

    setTimeout(function () {
      b.before();
      b.after();

      t.throws(function () {
        // throws because we reset
        b.after();
      });

      resolve();
    }, 100);
  });
});
