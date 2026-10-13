import test from "ava";

import TemplateConfig from "../src/TemplateConfig.js";
import EleventyWatchTargets from "../src/WatchTargets.js";
import JavaScriptDependencies from "../src/Util/JavaScriptDependencies.js";

test("Basic", (t) => {
  let targets = new EleventyWatchTargets();

  t.deepEqual(targets.getTargets(), []);

  targets.add(".eleventy.js");
  t.deepEqual(targets.getTargets(), ["./.eleventy.js"]);
});

test("Removes duplicates", (t) => {
  let targets = new EleventyWatchTargets();

  targets.add(".eleventy.js");
  targets.add("./.eleventy.js");
  t.deepEqual(targets.getTargets(), ["./.eleventy.js"]);
});

test("Add array", (t) => {
  let targets = new EleventyWatchTargets();

  targets.add([".eleventy.js", "b.js"]);
  targets.add(["b.js", "c.js"]);
  t.deepEqual(targets.getTargets(), ["./.eleventy.js", "./b.js", "./c.js"]);
});

test("Add and make glob", (t) => {
  let targets = new EleventyWatchTargets();

  // Note the `test` directory must exist here for this to pass.
  targets.add(["test", "test/b.js"]);
  t.deepEqual(targets.getTargets(), ["./test", "./test/b.js"]);
});

test("JavaScript get dependencies", async (t) => {
  t.deepEqual(
    await JavaScriptDependencies.getDependencies(["./test/stubs/config-deps.cjs"]),
    ["./test/stubs/config-deps-upstream.cjs"]
  );
});

test("JavaScript addDependencies", async (t) => {
  let targets = new EleventyWatchTargets();

  await targets.addDependencies("./test/stubs/config-deps.cjs");
  t.deepEqual(targets.getTargets(), ["./test/stubs/config-deps-upstream.cjs"]);

  t.true(targets.uses("./test/stubs/config-deps.cjs", "./test/stubs/config-deps-upstream.cjs"));
  t.false(targets.uses("./test/stubs/config-deps.cjs", "./test/stubs/config-deps.cjs"));
});

test("JavaScript addDependencies (one file has two dependencies)", async (t) => {
  let targets = new EleventyWatchTargets();

  await targets.addDependencies("./test/stubs/dependencies/two-deps.11ty.cjs");
  t.deepEqual(targets.getTargets(), [
    "./test/stubs/dependencies/dep1.cjs",
    "./test/stubs/dependencies/dep2.cjs",
  ]);

  t.true(
    targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep1.cjs"
    )
  );
  t.true(
    targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep2.cjs"
    )
  );
  t.false(
    targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep3.cjs"
    )
  );
});

test("JavaScript addDependencies (skip JS deps)", async (t) => {
  let templateConfig = new TemplateConfig();
  let targets = new EleventyWatchTargets(templateConfig);
  targets.watchJavaScriptDependencies = false;
  await targets.addDependencies("./test/stubs/dependencies/two-deps.11ty.cjs");

  t.deepEqual(targets.getTargets(), []);

  t.false(
    targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep1.cjs"
    )
  );
  t.false(
    targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep2.cjs"
    )
  );
  t.false(
    targets.uses(
      "./test/stubs/dependencies/two-deps.11ty.cjs",
      "./test/stubs/dependencies/dep3.cjs"
    )
  );
});

test("JavaScript addDependencies with a filter", async (t) => {
  let targets = new EleventyWatchTargets();
  await targets.addDependencies("./test/stubs/config-deps.cjs", function (path) {
    return path.indexOf("./test/stubs/") === -1;
  });
  t.deepEqual(targets.getTargets(), []);
  t.false(
    targets.uses(
      "./test/stubs/dependencies/config-deps.cjs",
      "./test/stubs/dependencies/config-deps-upstream.cjs"
    )
  );
});

test("add, addDependencies falsy values are filtered", async (t) => {
  let targets = new EleventyWatchTargets();
  targets.add("");
  await targets.addDependencies("");
  t.deepEqual(targets.getTargets(), []);
});

test("add, addDependencies file does not exist", async (t) => {
  let targets = new EleventyWatchTargets();

  targets.add("./.eleventy-notfound.js"); // does not exist
  await targets.addDependencies("./.eleventy-notfound.js"); // does not exist
  t.deepEqual(targets.getTargets(), ["./.eleventy-notfound.js"]);
});

test("getNewTargetsSinceLastReset", (t) => {
  let targets = new EleventyWatchTargets();

  targets.add("./.eleventy-notfound.js"); // does not exist
  t.deepEqual(targets.getNewTargetsSinceLastReset(), ["./.eleventy-notfound.js"]);
  t.deepEqual(targets.getNewTargetsSinceLastReset(), ["./.eleventy-notfound.js"]);

  targets.reset();
  targets.add("./.eleventy-notfound2.js");
  t.deepEqual(targets.getNewTargetsSinceLastReset(), ["./.eleventy-notfound2.js"]);

  targets.reset();
  t.deepEqual(targets.getNewTargetsSinceLastReset(), []);
});
