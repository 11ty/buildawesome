import test from "ava";
import { TemplateDepGraph } from "../src/Util/TemplateDepGraph.js";

test("Using new Template DepGraph", async (t) => {
  let graph = new TemplateDepGraph();

  graph.addTemplate("template-paginated-over-all.njk", ["all"], []);
  graph.addTemplate("template-paginated-over-userconfig.njk", ["[userconfig]"], []);
  graph.addTemplate("template-1.njk", [], ["all", "posts"]);
  graph.addTemplate("template-2.njk", [], ["all", "posts", "dog"]);
  graph.addTemplate("template-paginated-collections.njk", ["[keys]"], []);
  graph.addConfigCollectionName("myCollection");

  t.deepEqual(graph.unfilteredOrder(), [
    "template-1.njk",
    "template-2.njk",
    "__collection:posts",
    "__collection:dog",
    "__collection:[basic]",
    "__collection:[userconfig]",
    "template-paginated-over-userconfig.njk",
    "__collection:myCollection",
    "__collection:[keys]",
    "template-paginated-collections.njk",
    "__collection:all",
    "template-paginated-over-all.njk",
  ]);

  t.deepEqual(graph.overallOrder(), [
    "template-1.njk",
    "template-2.njk",
    "__collection:posts",
    "__collection:dog",
    "template-paginated-over-userconfig.njk",
    "__collection:myCollection",
    "__collection:[keys]",
    "template-paginated-collections.njk",
    "__collection:all",
    "template-paginated-over-all.njk",
    "__collection:all",
  ]);
});
