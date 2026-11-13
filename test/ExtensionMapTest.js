import test from "node:test";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";
import TemplateConfig from "../src/TemplateConfig.js";

async function getExtensionMap(formats, config = new TemplateConfig()) {
  if (config) {
    await config.init();
  }
  let map = new ExtensionMap(config);
  map.setFormats(formats);
  map.engineManager = new TemplateEngineManager(config);
  return map;
}

test("Empty formats", async (t) => {
  let map = await getExtensionMap([]);
  t.assert.deepStrictEqual(map.getGlobs("."), []);
});
test("Single format", async (t) => {
  let map = await getExtensionMap(["liquid"]);
  t.assert.deepStrictEqual(map.getGlobs("."), ["./**/*.liquid"]);
  t.assert.deepStrictEqual(map.getGlobs("src"), ["./src/**/*.liquid"]);
});
test("Multiple formats", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.assert.deepStrictEqual(map.getGlobs("."), ["./**/*.{njk,liquid}"]);
  t.assert.deepStrictEqual(map.getGlobs("src"), ["./src/**/*.{njk,liquid}"]);
});

test("Invalid keys are filtered (using passthrough copy)", async (t) => {
  let map = await getExtensionMap(["lksdjfjlsk"]);
  t.assert.deepStrictEqual(map.getGlobs("."), ["./**/*.lksdjfjlsk"]);
});

test("Keys are mapped to lower case", async (t) => {
  let map = await getExtensionMap(["LIQUID", "PUG", "NJK"]);
  t.assert.deepStrictEqual(map.getGlobs("."), ["./**/*.{liquid,pug,njk}"]);
});

test("Pruned globs", async (t) => {
  let map = await getExtensionMap(["liquid", "njk", "png"]);
  t.assert.deepStrictEqual(map.getPassthroughCopyGlobs("."), ["./**/*.png"]);
});

test("Empty path for fileList", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.assert.deepStrictEqual(map.getFileList(), []);
});

test("fileList", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.assert.deepStrictEqual(map.getFileList("filename"), ["filename.njk", "filename.liquid"]);
});

test("fileList with dir", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.assert.deepStrictEqual(map.getFileList("filename", "_includes"), [
    "_includes/filename.njk",
    "_includes/filename.liquid",
  ]);
});

test("fileList with dir in path", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.assert.deepStrictEqual(map.getFileList("layouts/filename"), [
    "layouts/filename.njk",
    "layouts/filename.liquid",
  ]);
});

test("fileList with dir in path and dir", async (t) => {
  let map = await getExtensionMap(["njk", "liquid", "pug"]);
  t.assert.deepStrictEqual(map.getFileList("layouts/filename", "_includes"), [
    "_includes/layouts/filename.njk",
    "_includes/layouts/filename.liquid",
  ]);
});

test("removeTemplateExtension", async (t) => {
  let map = await getExtensionMap(["njk", "11ty.js"]);
  t.assert.strictEqual(map.removeTemplateExtension("component.njk"), "component");
  t.assert.strictEqual(map.removeTemplateExtension("component.11ty.js"), "component");

  t.assert.strictEqual(map.removeTemplateExtension(""), "");
  t.assert.strictEqual(map.removeTemplateExtension("component"), "component");
  t.assert.strictEqual(map.removeTemplateExtension("component.js"), "component.js");
});

test("hasEngine", async (t) => {
  let map = await getExtensionMap(["liquid", "njk", "11ty.js"]);
  t.assert.strictEqual(map.hasEngine("default.liquid"), true);
  t.assert.strictEqual(map.getKey("default.liquid"), "liquid");
  t.assert.ok(!(map.getKey()));
  t.assert.strictEqual(map.getKey("LiQuid"), "liquid");
  t.assert.strictEqual(map.hasEngine("LiqUiD"), true);
  t.assert.strictEqual(map.hasEngine("liquid"), true);
  t.assert.ok(!(map.getKey("sldkjfkldsj")));
  t.assert.strictEqual(map.hasEngine("sldkjfkldsj"), false);

  t.assert.strictEqual(map.getKey("11ty.js"), "11ty.js");
  t.assert.strictEqual(map.hasEngine("11ty.js"), true);

  t.assert.ok(!(map.getKey("md")));
  t.assert.strictEqual(map.hasEngine("md"), false);
});

test("hasEngine no formats passed in", async (t) => {
  let map = await getExtensionMap([]);
  t.assert.strictEqual(map.hasEngine("default.liquid"), false);
  t.assert.ok(!(map.getKey("default.liquid")));
  t.assert.ok(!(map.getKey()));
  t.assert.ok(!(map.getKey("LiQuid")));
  t.assert.strictEqual(map.hasEngine("LiqUiD"), false);
  t.assert.strictEqual(map.hasEngine("liquid"), false);
  t.assert.ok(!(map.getKey("sldkjfkldsj")));
  t.assert.strictEqual(map.hasEngine("sldkjfkldsj"), false);
  t.assert.ok(!(map.getKey("11ty.js")));
  t.assert.strictEqual(map.hasEngine("11ty.js"), false);
  t.assert.ok(!(map.getKey("md")));
  t.assert.strictEqual(map.hasEngine("md"), false);
});

test("getKey", async (t) => {
  let map = await getExtensionMap(["njk", "11ty.js", "md"]);
  t.assert.strictEqual(map.getKey("component.njk"), "njk");
  t.assert.strictEqual(map.getKey("component.11ty.js"), "11ty.js");
  t.assert.strictEqual(map.getKey("11ty.js"), "11ty.js");
  t.assert.strictEqual(map.getKey(".11ty.js"), "11ty.js");

  t.assert.strictEqual(map.getKey("sample.md"), "md");

  t.assert.strictEqual(map.getKey(""), undefined);
  t.assert.strictEqual(map.getKey("js"), undefined);
  t.assert.strictEqual(map.getKey("component"), undefined);
  t.assert.strictEqual(map.getKey("component.js"), undefined);
});

test("isFullTemplateFilePath (not a passthrough copy extension)", async (t) => {
  let map = await getExtensionMap(["liquid", "njk", "11ty.js", "js", "css"]);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.liquid"), true);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.njk"), true);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.11ty.js"), true);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.ejs"), false);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.pug"), false);
  t.assert.strictEqual(map.isFullTemplateFilePath("passthrough.js"), false);
  t.assert.strictEqual(map.isFullTemplateFilePath("passthrough.css"), false);
});

test("isFullTemplateFilePath with other extensions for a key", async (t) => {
  let map = await getExtensionMap(["njk", "11ty.js"]);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.11ty.cjs"), true);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.11ty.mjs"), true);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.server.js"), true);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.server.mjs"), true);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.js"), false);
  t.assert.strictEqual(map.isFullTemplateFilePath("template.mjs"), false);
});

test("getValidExtensionsForPath", async (t) => {
  let cfg = new TemplateConfig();
  cfg.userConfig.extensionMap.add({
    key: "js",
    extension: "js",
  });
  await cfg.init();

  let map = await getExtensionMap(["liquid", "njk", "11ty.js", "js"], cfg);

  t.assert.deepStrictEqual(map.getValidExtensionsForPath("template.liquid"), ["liquid"]);
  t.assert.deepStrictEqual(map.getValidExtensionsForPath("template.11ty.js"), ["11ty.js", "js"]);
  t.assert.deepStrictEqual(map.getValidExtensionsForPath("template.pug"), []);
  t.assert.deepStrictEqual(map.getValidExtensionsForPath("template.liquid.js"), ["js"]);
  t.assert.deepStrictEqual(map.getValidExtensionsForPath("njk.liquid.11ty.js"), ["11ty.js", "js"]);
  t.assert.deepStrictEqual(map.getValidExtensionsForPath("template.server.js"), ["server.js", "js"]);
  t.assert.deepStrictEqual(map.getValidExtensionsForPath("template.11ty.mjs"), ["11ty.mjs"]);
});

test("shouldSpiderJavaScriptDependencies", async (t) => {
  let cfg = new TemplateConfig();
  cfg.userConfig.extensionMap.add({
    key: "js",
    extension: "js",
  });
  await cfg.init();

  let map = await getExtensionMap(["liquid", "njk", "11ty.js", "js"], cfg);

  t.assert.deepStrictEqual(await map.shouldSpiderJavaScriptDependencies("template.liquid"), false);
  t.assert.deepStrictEqual(await map.shouldSpiderJavaScriptDependencies("template.njk"), false);
  t.assert.deepStrictEqual(await map.shouldSpiderJavaScriptDependencies("template.css"), false);
  t.assert.deepStrictEqual(await map.shouldSpiderJavaScriptDependencies("template.11ty.js"), true);
  t.assert.deepStrictEqual(await map.shouldSpiderJavaScriptDependencies("template.js"), false);
  t.assert.deepStrictEqual(await map.shouldSpiderJavaScriptDependencies("template.11ty.mjs"), true);
  t.assert.deepStrictEqual(await map.shouldSpiderJavaScriptDependencies("template.server.js"), true);
});
