import test from "node:test";

import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateConfig from "../src/TemplateConfig.js";
import { getTemplateConfigInstance } from "./_testHelpers.js";

test("Unsupported engine", async (t) => {
  await t.assert.rejects(async () => {
    let eleventyConfig = new TemplateConfig();
    let tem = new TemplateEngineManager(eleventyConfig);
    await tem.getEngine("doesnotexist");
  });
});

test("Supported engine", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let tem = new TemplateEngineManager(eleventyConfig);
  t.assert.ok(tem.hasEngine("11ty.js"));
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

  t.assert.ok(tem.hasEngine("txt"));
  let engine = await tem.getEngine("txt", extensionMap);
  let fn = await engine.compile("<p>This is plaintext</p>");
  t.assert.strictEqual(await fn({ author: "zach" }), "<p>This is plaintext</p>");
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

  t.assert.ok(tem.hasEngine("custom1"));
  let engine = await tem.getEngine("custom1", extensionMap);
  let fn = await engine.compile("<p>This is plaintext</p>");
  t.assert.strictEqual(await fn({}), "<p>This is plaintext</p>");

  let engine2 = await tem.getEngine("custom1");
  t.assert.strictEqual(engine, engine2);

  let fn2 = await engine2.compile("<p>This is plaintext</p>");
  t.assert.strictEqual(await fn2({}), "<p>This is plaintext</p>");

  t.assert.strictEqual(initCount, 1, "Should have only run the init callback once");
  t.assert.strictEqual(compileCount, 2, "Should have only run the compile callback twice");
});

test("getEngineLib", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();
  let extensionMap = new ExtensionMap(eleventyConfig);

  let tem = new TemplateEngineManager(eleventyConfig);
  let engine = await tem.getEngine("md", extensionMap);
  t.assert.ok(engine.getEngineLib());
});

test("Engine event listeners are removed when the engine cache is reset", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  let extensionMap = new ExtensionMap(eleventyConfig);

  let events = eleventyConfig.userConfig.events;
  let count = () => events.listenerCount("buildawesome#templatemodified");
  let before = count();

  let tem = new TemplateEngineManager(eleventyConfig);
  for (let j = 0; j < 5; j++) {
    await tem.getEngine("njk", extensionMap);
    await tem.getEngine("11ty.js", extensionMap);
    tem.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  t.assert.strictEqual(count(), before);
});

test("Nunjucks setLibrary does not add another templateModified listener", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  let extensionMap = new ExtensionMap(eleventyConfig);

  let events = eleventyConfig.userConfig.events;
  let count = () => events.listenerCount("buildawesome#templatemodified");

  let tem = new TemplateEngineManager(eleventyConfig);
  let engine = await tem.getEngine("njk", extensionMap);
  let expected = count();

  engine.setLibrary();
  engine.setLibrary();

  t.assert.strictEqual(count(), expected);
});
