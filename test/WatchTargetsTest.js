import test from "node:test";

import TemplateConfig from "../src/TemplateConfig.js";
import EleventyWatchTargets from "../src/WatchTargets.js";
import JavaScriptDependencies from "../src/Util/JavaScriptDependencies.js";

test("Basic", (t) => {
  let targets = new EleventyWatchTargets();

  t.assert.deepStrictEqual(targets.getTargets(), []);

  targets.add(".eleventy.js");
  t.assert.deepStrictEqual(targets.getTargets(), ["./.eleventy.js"]);
});

test("Removes duplicates", (t) => {
  let targets = new EleventyWatchTargets();

  targets.add(".eleventy.js");
  targets.add("./.eleventy.js");
  t.assert.deepStrictEqual(targets.getTargets(), ["./.eleventy.js"]);
});

test("Add array", (t) => {
  let targets = new EleventyWatchTargets();

  targets.add([".eleventy.js", "b.js"]);
  targets.add(["b.js", "c.js"]);
  t.assert.deepStrictEqual(targets.getTargets(), ["./.eleventy.js", "./b.js", "./c.js"]);
});

test("Add and make glob", (t) => {
  let targets = new EleventyWatchTargets();

  // Note the `test` directory must exist here for this to pass.
  targets.add(["test", "test/b.js"]);
  t.assert.deepStrictEqual(targets.getTargets(), ["./test", "./test/b.js"]);
});

test("JavaScript get dependencies", async (t) => {
  t.assert.deepStrictEqual(
    await JavaScriptDependencies.getDependencies(["./test/stubs/config-deps.cjs"]),
    ["./test/stubs/config-deps-upstream.cjs"]
  );
});

test("JavaScript addDependencies", async (t) => {
  let targets = new EleventyWatchTargets();

  await targets.addDependencies("./test/stubs/config-deps.cjs");
  t.assert.deepStrictEqual(targets.getTargets(), ["./test/stubs/config-deps-upstream.cjs"]);

  t.assert.strictEqual(targets.uses("./test/stubs/config-deps.cjs", "./test/stubs/config-deps-upstream.cjs"), true);
  t.assert.strictEqual(targets.uses("./test/stubs/config-deps.cjs", "./test/stubs/config-deps.cjs"), false);
});

test("JavaScript addDependencies (one file has two dependencies)", async (t) => {
  let targets = new EleventyWatchTargets();

  await targets.addDependencies("./test/stubs/dependencies/two-deps.11ty.cjs");
  t.assert.deepStrictEqual(targets.getTargets(), [
    "./test/stubs/dependencies/dep1.cjs",
    "./test/stubs/dependencies/dep2.cjs",
  ]);

  t.assert.strictEqual(targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep1.cjs"
    ), true);
  t.assert.strictEqual(targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep2.cjs"
    ), true);
  t.assert.strictEqual(targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep3.cjs"
    ), false);
});

test("JavaScript addDependencies (skip JS deps)", async (t) => {
  let templateConfig = new TemplateConfig();
  let targets = new EleventyWatchTargets(templateConfig);
  targets.watchJavaScriptDependencies = false;
  await targets.addDependencies("./test/stubs/dependencies/two-deps.11ty.cjs");

  t.assert.deepStrictEqual(targets.getTargets(), []);

  t.assert.strictEqual(targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep1.cjs"
    ), false);
  t.assert.strictEqual(targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep2.cjs"
    ), false);
  t.assert.strictEqual(targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep3.cjs"
    ), false);
});

test("JavaScript addDependencies with a filter", async (t) => {
  let targets = new EleventyWatchTargets();
  await targets.addDependencies("./test/stubs/config-deps.cjs", function (path) {
    return path.indexOf("./test/stubs/") === -1;
  });
  t.assert.deepStrictEqual(targets.getTargets(), []);
  t.assert.strictEqual(targets.uses(
      "./test/stubs/dependencies/config-deps.cjs",
      "./test/stubs/dependencies/config-deps-upstream.cjs"
    ), false);
});

test("JavaScript addDependencies with a filter keeps the dependency graph", async (t) => {
  let targets = new EleventyWatchTargets();
  await targets.addDependencies("./test/stubs/config-deps.cjs", function (path) {
    return path.indexOf("./test/stubs/") === -1;
  });
  t.assert.deepStrictEqual(targets.getTargets(), []);
  t.assert.deepStrictEqual(targets.getDependantsOf("./test/stubs/config-deps-upstream.cjs"), [
    "./test/stubs/config-deps.cjs",
  ]);
});

test("add, addDependencies falsy values are filtered", async (t) => {
  let targets = new EleventyWatchTargets();
  targets.add("");
  await targets.addDependencies("");
  t.assert.deepStrictEqual(targets.getTargets(), []);
});

test("add, addDependencies file does not exist", async (t) => {
  let targets = new EleventyWatchTargets();

  targets.add("./.eleventy-notfound.js"); // does not exist
  await targets.addDependencies("./.eleventy-notfound.js"); // does not exist
  t.assert.deepStrictEqual(targets.getTargets(), ["./.eleventy-notfound.js"]);
});

test("getNewTargetsSinceLastReset", (t) => {
  let targets = new EleventyWatchTargets();

  targets.add("./.eleventy-notfound.js"); // does not exist
  t.assert.deepStrictEqual(targets.getNewTargetsSinceLastReset(), ["./.eleventy-notfound.js"]);
  t.assert.deepStrictEqual(targets.getNewTargetsSinceLastReset(), ["./.eleventy-notfound.js"]);

  targets.reset();
  targets.add("./.eleventy-notfound2.js");
  t.assert.deepStrictEqual(targets.getNewTargetsSinceLastReset(), ["./.eleventy-notfound2.js"]);

  targets.reset();
  t.assert.deepStrictEqual(targets.getNewTargetsSinceLastReset(), []);
});
