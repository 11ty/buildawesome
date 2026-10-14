import test from "ava";
import ComputedDataQueue from "../src/Data/ComputedDataQueue.js";

test("Standard uses", (t) => {
  let queue = new ComputedDataQueue();
  queue.uses("permalink", ["var1", "var2"]);
  queue.uses("collections.all", ["var2", "var3"]);
  t.deepEqual(queue.getOrder(), ["var1", "var2", "permalink", "var3", "collections.all"]);
});

test("What does permalink use", (t) => {
  let queue = new ComputedDataQueue();
  queue.uses("permalink", ["var1", "var2"]);
  queue.uses("collections.all", ["var2", "var3"]);

  let varsUsedByPermalink = queue.getOrderFor("permalink");
  t.deepEqual(varsUsedByPermalink, ["var1", "var2"]);

  // After we process these
  queue.markComputed(["permalink", ...varsUsedByPermalink]);
  t.deepEqual(queue.getOrder(), ["var3", "collections.all"]);
});

test("What does page.url and page.outputPath use", (t) => {
  let queue = new ComputedDataQueue();
  queue.uses("page.url", ["permalink"]);
  queue.uses("page.url", ["var1", "var2"]);
  queue.uses("page.outputPath", ["permalink"]);
  queue.uses("page.outputPath", ["var2", "var3"]);

  let varsUsedByPageUrl = queue.getOrderFor("page.url");
  t.deepEqual(varsUsedByPageUrl, ["permalink", "var1", "var2"]);
  queue.markComputed([...varsUsedByPageUrl, "page.url"]);
  t.deepEqual(queue.getOrder(), ["var3", "page.outputPath"]);

  let varsUsedByPageOutput = queue.getOrderFor("page.outputPath");
  // even though page.outputPath used permalink and var2,
  // they were already computed above by page.url
  t.deepEqual(varsUsedByPageOutput, ["var3"]);
  queue.markComputed([...varsUsedByPageOutput, "page.outputPath"]);
  t.deepEqual(queue.getOrder(), []);
});

test("Permalink uses a collection (not yet supported in Eleventy)", (t) => {
  let queue = new ComputedDataQueue();
  queue.uses("permalink", ["collections.dog", "var2"]);
  queue.uses("collections.all", ["var2", "var3"]);
  queue.uses("collections.dog", ["hi"]);
  queue.uses("unrelated", ["test"]);

  t.deepEqual(queue.getDependsOn("collections.dog"), ["permalink"]);
  t.deepEqual(queue.getDependsOn("var2"), ["permalink", "collections.all"]);
  t.deepEqual(queue.getDependsOn("collections.all"), []);
  t.deepEqual(queue.getDependsOn("hi"), ["permalink", "collections.dog"]);
  t.is(queue.isUsesStartsWith("collections.dog", "hi"), true);
  t.is(queue.isUsesStartsWith("permalink", "collections."), true);
  t.is(queue.isUsesStartsWith("unrelated", "collections."), false);

  t.deepEqual(queue.getOrderFor("unrelated"), ["test"]);

  let varsUsedByPermalink = queue.getOrderFor("permalink");
  t.deepEqual(varsUsedByPermalink, ["hi", "collections.dog", "var2"]);

  // After we process these
  queue.markComputed(["permalink", ...varsUsedByPermalink]);
  t.deepEqual(queue.getOrder(), ["var3", "collections.all", "test", "unrelated"]);
});
