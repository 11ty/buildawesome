import test from "ava";
import { DepGraph as DependencyGraph } from "dependency-graph";

test("Dependency graph nodes don’t require dependencies", async (t) => {
  let graph = new DependencyGraph();

  graph.addNode("all");
  graph.addNode("template-a");
  graph.addNode("template-b");
  graph.addNode("template-c");

  let order = graph.overallOrder();
  t.true(order.includes("all"));
  t.true(order.includes("template-a"));
  t.true(order.includes("template-b"));
  t.true(order.includes("template-c"));

  // in order of addNode
  t.deepEqual(graph.overallOrder(), ["all", "template-a", "template-b", "template-c"]);
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

  t.deepEqual(graph.overallOrder(), [
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
  t.deepEqual(graph.overallOrder(), ["template-b", "template-a"]);

  t.deepEqual(graph.dependenciesOf("template-a"), ["template-b"]);

  graph.removeNode("template-b");
  t.deepEqual(graph.dependenciesOf("template-a"), []);

  graph.addNode("template-b");
  t.deepEqual(graph.dependenciesOf("template-a"), []);

  t.deepEqual(graph.overallOrder(), ["template-a", "template-b"]);
});
