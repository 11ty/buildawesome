import test from "node:test";
import { DepGraph as DependencyGraph } from "dependency-graph";

test("Dependency graph nodes don’t require dependencies", async (t) => {
  let graph = new DependencyGraph();

  graph.addNode("all");
  graph.addNode("template-a");
  graph.addNode("template-b");
  graph.addNode("template-c");

  let order = graph.overallOrder();
  t.assert.strictEqual(order.includes("all"), true);
  t.assert.strictEqual(order.includes("template-a"), true);
  t.assert.strictEqual(order.includes("template-b"), true);
  t.assert.strictEqual(order.includes("template-c"), true);

  // in order of addNode
  t.assert.deepStrictEqual(graph.overallOrder(), ["all", "template-a", "template-b", "template-c"]);
});

test("Dependency graph relationships", async (t) => {
  let graph = new DependencyGraph();

  graph.addNode("all");
  graph.addNode("template-a");
  graph.addNode("template-b");
  graph.addNode("template-c");
  graph.addNode("userCollection");

  graph.addDependency("all", "template-a");
  graph.addDependency("all", "template-b");
  graph.addDependency("all", "template-c");
  graph.addDependency("userCollection", "all");

  t.assert.deepStrictEqual(graph.overallOrder(), [
    "template-a",
    "template-b",
    "template-c",
    "all",
    "userCollection",
  ]);
});

test("Do dependencies (edges) get removed when nodes are deleted? (yes)", async (t) => {
  let graph = new DependencyGraph();

  graph.addNode("template-a");
  graph.addNode("template-b");
  graph.addDependency("template-a", "template-b");
  t.assert.deepStrictEqual(graph.overallOrder(), ["template-b", "template-a"]);

  t.assert.deepStrictEqual(graph.dependenciesOf("template-a"), ["template-b"]);

  graph.removeNode("template-b");
  t.assert.deepStrictEqual(graph.dependenciesOf("template-a"), []);

  graph.addNode("template-b");
  t.assert.deepStrictEqual(graph.dependenciesOf("template-a"), []);

  t.assert.deepStrictEqual(graph.overallOrder(), ["template-a", "template-b"]);
});
