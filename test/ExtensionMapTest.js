import test from "ava";
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
  t.deepEqual(map.getGlobs("."), []);
});
test("Single format", async (t) => {
  let map = await getExtensionMap(["liquid"]);
  t.deepEqual(map.getGlobs("."), ["./**/*.liquid"]);
  t.deepEqual(map.getGlobs("src"), ["./src/**/*.liquid"]);
});
test("Multiple formats", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.deepEqual(map.getGlobs("."), ["./**/*.{njk,liquid}"]);
  t.deepEqual(map.getGlobs("src"), ["./src/**/*.{njk,liquid}"]);
});

test("Invalid keys are filtered (using passthrough copy)", async (t) => {
  let map = await getExtensionMap(["lksdjfjlsk"]);
  t.deepEqual(map.getGlobs("."), ["./**/*.lksdjfjlsk"]);
});

test("Keys are mapped to lower case", async (t) => {
  let map = await getExtensionMap(["LIQUID", "PUG", "NJK"]);
  t.deepEqual(map.getGlobs("."), ["./**/*.{liquid,pug,njk}"]);
});

test("Pruned globs", async (t) => {
  let map = await getExtensionMap(["liquid", "njk", "png"]);
  t.deepEqual(map.getPassthroughCopyGlobs("."), ["./**/*.png"]);
});

test("Empty path for fileList", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.deepEqual(map.getFileList(), []);
});

test("fileList", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.deepEqual(map.getFileList("filename"), ["filename.njk", "filename.liquid"]);
});

test("fileList with dir", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.deepEqual(map.getFileList("filename", "_includes"), [
    "_includes/filename.njk",
    "_includes/filename.liquid",
  ]);
});

test("fileList with dir in path", async (t) => {
  let map = await getExtensionMap(["njk", "liquid"]);
  t.deepEqual(map.getFileList("layouts/filename"), [
    "layouts/filename.njk",
    "layouts/filename.liquid",
  ]);
});

test("fileList with dir in path and dir", async (t) => {
  let map = await getExtensionMap(["njk", "liquid", "pug"]);
  t.deepEqual(map.getFileList("layouts/filename", "_includes"), [
    "_includes/layouts/filename.njk",
    "_includes/layouts/filename.liquid",
  ]);
});

test("removeTemplateExtension", async (t) => {
  let map = await getExtensionMap(["njk", "11ty.js"]);
  t.is(map.removeTemplateExtension("component.njk"), "component");
  t.is(map.removeTemplateExtension("component.11ty.js"), "component");

  t.is(map.removeTemplateExtension(""), "");
  t.is(map.removeTemplateExtension("component"), "component");
  t.is(map.removeTemplateExtension("component.js"), "component.js");
});

test("hasEngine", async (t) => {
  let map = await getExtensionMap(["liquid", "njk", "11ty.js"]);
  t.true(map.hasEngine("default.liquid"));
  t.is(map.getKey("default.liquid"), "liquid");
  t.falsy(map.getKey());
  t.is(map.getKey("LiQuid"), "liquid");
  t.true(map.hasEngine("LiqUiD"));
  t.true(map.hasEngine("liquid"));
  t.falsy(map.getKey("sldkjfkldsj"));
  t.false(map.hasEngine("sldkjfkldsj"));

  t.is(map.getKey("11ty.js"), "11ty.js");
  t.true(map.hasEngine("11ty.js"));

  t.falsy(map.getKey("md"));
  t.false(map.hasEngine("md"));
});

test("hasEngine no formats passed in", async (t) => {
  let map = await getExtensionMap([]);
  t.false(map.hasEngine("default.liquid"));
  t.falsy(map.getKey("default.liquid"));
  t.falsy(map.getKey());
  t.falsy(map.getKey("LiQuid"));
  t.false(map.hasEngine("LiqUiD"));
  t.false(map.hasEngine("liquid"));
  t.falsy(map.getKey("sldkjfkldsj"));
  t.false(map.hasEngine("sldkjfkldsj"));
  t.falsy(map.getKey("11ty.js"));
  t.false(map.hasEngine("11ty.js"));
  t.falsy(map.getKey("md"));
  t.false(map.hasEngine("md"));
});

test("getKey", async (t) => {
  let map = await getExtensionMap(["njk", "11ty.js", "md"]);
  t.is(map.getKey("component.njk"), "njk");
  t.is(map.getKey("component.11ty.js"), "11ty.js");
  t.is(map.getKey("11ty.js"), "11ty.js");
  t.is(map.getKey(".11ty.js"), "11ty.js");

  t.is(map.getKey("sample.md"), "md");

  t.is(map.getKey(""), undefined);
  t.is(map.getKey("js"), undefined);
  t.is(map.getKey("component"), undefined);
  t.is(map.getKey("component.js"), undefined);
});

test("isFullTemplateFilePath (not a passthrough copy extension)", async (t) => {
  let map = await getExtensionMap(["liquid", "njk", "11ty.js", "js", "css"]);
  t.true(map.isFullTemplateFilePath("template.liquid"));
  t.true(map.isFullTemplateFilePath("template.njk"));
  t.true(map.isFullTemplateFilePath("template.11ty.js"));
  t.false(map.isFullTemplateFilePath("template.ejs"));
  t.false(map.isFullTemplateFilePath("template.pug"));
  t.false(map.isFullTemplateFilePath("passthrough.js"));
  t.false(map.isFullTemplateFilePath("passthrough.css"));
});

test("getValidExtensionsForPath", async (t) => {
  let cfg = new TemplateConfig();
  cfg.userConfig.extensionMap.add({
    key: "js",
    extension: "js",
  });
  await cfg.init();

  let map = await getExtensionMap(["liquid", "njk", "11ty.js", "js"], cfg);

  t.deepEqual(map.getValidExtensionsForPath("template.liquid"), ["liquid"]);
  t.deepEqual(map.getValidExtensionsForPath("template.11ty.js"), ["11ty.js", "js"]);
  t.deepEqual(map.getValidExtensionsForPath("template.pug"), []);
  t.deepEqual(map.getValidExtensionsForPath("template.liquid.js"), ["js"]);
  t.deepEqual(map.getValidExtensionsForPath("njk.liquid.11ty.js"), ["11ty.js", "js"]);
});

test("shouldSpiderJavaScriptDependencies", async (t) => {
  let cfg = new TemplateConfig();
  cfg.userConfig.extensionMap.add({
    key: "js",
    extension: "js",
  });
  await cfg.init();

  let map = await getExtensionMap(["liquid", "njk", "11ty.js", "js"], cfg);

  t.deepEqual(await map.shouldSpiderJavaScriptDependencies("template.liquid"), false);
  t.deepEqual(await map.shouldSpiderJavaScriptDependencies("template.njk"), false);
  t.deepEqual(await map.shouldSpiderJavaScriptDependencies("template.css"), false);
  t.deepEqual(await map.shouldSpiderJavaScriptDependencies("template.11ty.js"), true);
  t.deepEqual(await map.shouldSpiderJavaScriptDependencies("template.js"), false);
});
