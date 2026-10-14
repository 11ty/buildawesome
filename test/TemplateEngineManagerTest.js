import test from "ava";

import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateConfig from "../src/TemplateConfig.js";

test("Unsupported engine", async (t) => {
  await t.throwsAsync(async () => {
    let eleventyConfig = new TemplateConfig();
    let tem = new TemplateEngineManager(eleventyConfig);
    await tem.getEngine("doesnotexist");
  });
});

test("Supported engine", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let tem = new TemplateEngineManager(eleventyConfig);
  t.truthy(tem.hasEngine("11ty.js"));
});

test("Supported custom engine", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.extensionMap.add({
    extension: "txt",
    key: "txt",
    compile: function (str, inputPath) {
      // plaintext
      return function (data) {
        return str;
      };
    },
  });
  await eleventyConfig.init();

  let extensionMap = new ExtensionMap(eleventyConfig);

  let tem = new TemplateEngineManager(eleventyConfig);

  t.truthy(tem.hasEngine("txt"));
  let engine = await tem.getEngine("txt", extensionMap);
  let fn = await engine.compile("<p>This is plaintext</p>");
  t.is(await fn({ author: "zach" }), "<p>This is plaintext</p>");
});

test("Custom engine with custom init", async (t) => {
  let initCount = 0;
  let compileCount = 0;
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.extensionMap.add({
    extension: "custom1",
    key: "custom1",
    init: async function () {
      // do custom things, but only once
      initCount++;
    },
    compile: function (str, inputPath) {
      compileCount++;
      return () => str;
    },
  });
  await eleventyConfig.init();

  let extensionMap = new ExtensionMap(eleventyConfig);

  // let config = eleventyConfig.getConfig();
  let tem = new TemplateEngineManager(eleventyConfig);

  t.truthy(tem.hasEngine("custom1"));
  let engine = await tem.getEngine("custom1", extensionMap);
  let fn = await engine.compile("<p>This is plaintext</p>");
  t.is(await fn({}), "<p>This is plaintext</p>");

  let engine2 = await tem.getEngine("custom1");
  t.is(engine, engine2);

  let fn2 = await engine2.compile("<p>This is plaintext</p>");
  t.is(await fn2({}), "<p>This is plaintext</p>");

  t.is(initCount, 1, "Should have only run the init callback once");
  t.is(compileCount, 2, "Should have only run the compile callback twice");
});

test("getEngineLib", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();
  let extensionMap = new ExtensionMap(eleventyConfig);

  let tem = new TemplateEngineManager(eleventyConfig);
  let engine = await tem.getEngine("md", extensionMap);
  t.truthy(engine.getEngineLib());
});
