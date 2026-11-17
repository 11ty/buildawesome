import test from "node:test";

import Eleventy from "../src/Core.js";
import TemplateData from "../src/Data/TemplateData.js";
import ExtensionMap from "../src/ExtensionMap.js";
import { isTypeScriptSupported } from "../src/Util/TypeScriptFeatureTest.cjs";
import { getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

const TS = isTypeScriptSupported();

async function getPaths(callback, templatePath = "./test/stubs/component/component.liquid") {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({ input: "test/stubs" }, callback);
  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  return dataObj.getLocalDataPaths(templatePath);
}

function jsPaths(base) {
  // Lowest priority first, matching getLocalDataPaths output
  return [
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}.js`,
    ...(TS ? [`${base}.mts`, `${base}.cts`, `${base}.ts`] : []),
  ];
}

test("setDataFileNames directory pattern without a suffix (#2872)", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.setDataFileNames({ template: [], directory: ["_data.{ext}"] });
  });

  t.assert.deepStrictEqual(paths, ["./test/stubs/_data.json", "./test/stubs/component/_data.json"]);
});

test("setDataFileNames `{ext}` includes user data extensions but not JavaScript", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.addDataExtension("yaml", () => ({}));
    cfg.setDataFileNames({ template: [], directory: ["_data.{ext}"] });
  });

  t.assert.deepStrictEqual(paths, [
    "./test/stubs/_data.yaml",
    "./test/stubs/_data.json",
    "./test/stubs/component/_data.yaml",
    "./test/stubs/component/_data.json",
  ]);
});

test("setDataFileNames `{ext}` excludes JavaScript even when added as a data extension", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.addDataExtension("js, mjs", () => ({}));
    cfg.setDataFileNames({ template: [], directory: ["_data.{ext}"] });
  });

  t.assert.deepStrictEqual(paths, ["./test/stubs/_data.json", "./test/stubs/component/_data.json"]);
});

test("Legacy suffixes still include JavaScript added as a data extension", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.addDataExtension("js", () => ({}));
    cfg.setDataFileSuffixes([""]);
  });

  t.assert.deepStrictEqual(paths, [
    "./test/stubs/stubs.js",
    "./test/stubs/stubs.json",
    "./test/stubs/component/component.js",
    "./test/stubs/component/component.json",
  ]);
});

test("setDataFileNames `{js}` opts into JavaScript data files", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.setDataFileNames({ template: [], directory: ["_data.{js}"] });
  });

  t.assert.deepStrictEqual(paths, [
    ...jsPaths("./test/stubs/_data"),
    ...jsPaths("./test/stubs/component/_data"),
  ]);
});

test("setDataFileNames earlier patterns have higher priority", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.setDataFileNames({ template: [], directory: ["_data.{ext}", "_data.{js}"] });
  });

  let json = paths.indexOf("./test/stubs/component/_data.json");
  let js = paths.indexOf("./test/stubs/component/_data.js");
  // Later in the list wins when merging
  t.assert.ok(json > js);
  t.assert.strictEqual(paths.at(-1), "./test/stubs/component/_data.json");
});

test("setDataFileNames template patterns are independent from directory patterns", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.setDataFileNames({ template: ["{name}.data.{ext}"] });
  }, "./test/stubs/component/other.liquid");

  t.assert.deepStrictEqual(
    paths.filter((p) => p.startsWith("./test/stubs/component/other.")),
    ["./test/stubs/component/other.data.json"],
  );
  // Directory patterns keep the defaults
  t.assert.ok(paths.includes("./test/stubs/stubs.json"));
  t.assert.ok(paths.includes("./test/stubs/stubs.11tydata.js"));
});

test("setDataFileNames takes precedence over setDataFileBaseName and setDataFileSuffixes", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.setDataFileBaseName("index");
    cfg.setDataFileSuffixes([".howdy"]);
    cfg.setDataFileNames({ directory: ["{name}.{ext}"] });
  });

  t.assert.deepStrictEqual(paths, [
    "./test/stubs/stubs.json",
    "./test/stubs/component/component.json",
    "./test/stubs/component/component.howdy.json",
    ...jsPaths("./test/stubs/component/component.howdy"),
  ]);
});

test("setDataFileNames empty arrays disable data files", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.setDataFileNames({ template: [], directory: [] });
  });

  t.assert.deepStrictEqual(paths, []);
});

test("setDataFileNames `false` disables a kind of data file", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.setDataFileNames({ template: false, directory: ["_data.{ext}"] });
  });
  t.assert.deepStrictEqual(paths, ["./test/stubs/_data.json", "./test/stubs/component/_data.json"]);

  paths = await getPaths(function(cfg) {
    cfg.setDataFileNames({ directory: false });
  }, "./test/stubs/component/other.liquid");
  t.assert.ok(paths.length > 0);
  t.assert.ok(paths.every((p) => p.startsWith("./test/stubs/component/other.")));
});

test("setDataFileNames(false) disables all data files", async (t) => {
  let paths = await getPaths(function(cfg) {
    cfg.setDataFileNames(false);
  });

  t.assert.deepStrictEqual(paths, []);
});

test("setDataFileNames validates its input", async (t) => {
  await t.assert.rejects(
    getPaths(function(cfg) {
      cfg.setDataFileNames({ directory: "_data.{ext}" });
    }),
    { message: "`setDataFileNames` expects `directory` to be an Array of strings or `false`." },
  );
});

test("setDataFileNames watch globs", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({ input: "test/stubs" }, function(cfg) {
    cfg.setDataFileNames({ template: ["{name}.data.{ext}"], directory: ["_data.{ext}", "_data.{js}"] });
  });
  let dataObj = new TemplateData(eleventyConfig);

  t.assert.deepStrictEqual(dataObj.getTemplateDataFileGlob(), [
    `./test/stubs/**/{*.data.json,_data.json,${TS ? "_data.ts,_data.cts,_data.mts," : ""}_data.js,_data.cjs,_data.mjs}`,
  ]);
  t.assert.deepStrictEqual(dataObj.getTemplateJavaScriptDataFileGlob(), [
    `./test/stubs/**/{${TS ? "_data.ts,_data.cts,_data.mts," : ""}_data.js,_data.cjs,_data.mjs}`,
  ]);
});

test("setDataFileNames end to end (#2872)", async (t) => {
  let elev = new Eleventy("./test/stubs-data-file-names/", undefined, {
    config: function($config) {
      $config.addDataExtension("yaml", (contents) => ({ section: contents.trim().split(": ")[1] }));
      $config.setDataFileNames({ directory: ["_data.{ext}"] });
    },
  });

  let results = await elev.toJSON();
  let byPath = Object.fromEntries(results.map((entry) => [entry.inputPath, entry.content.trim()]));

  t.assert.deepStrictEqual(byPath, {
    "./test/stubs-data-file-names/articles/post.md": "<p>articles||post</p>",
    "./test/stubs-data-file-names/notes/note.md": "<p>notes</p>",
  });
});
