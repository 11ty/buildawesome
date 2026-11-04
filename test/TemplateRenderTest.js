import test from "node:test";

import TemplateRender from "../src/TemplateRender.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";
import { TemplatePipeline } from "../src/TemplatePipeline.js";

import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

async function getNewTemplateRender(name, inputDir) {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: inputDir
    }
  });

  let tr = new TemplateRender(name, eleventyConfig);
  tr.extensionMap = new ExtensionMap(eleventyConfig);
  tr.extensionMap.engineManager = new TemplateEngineManager(eleventyConfig);
  tr.extensionMap.setFormats([]);
  await tr.init();
  return tr;
}

test("Basic", async (t) => {
  await t.assert.rejects(async () => {
    let tr = await getNewTemplateRender("sldkjfkldsj");
    tr.init("sldkjfkldsj");
  });
});

test("Includes Dir", async (t) => {
  let tr = await getNewTemplateRender("liquid", "./test/stubs");
  t.assert.strictEqual(tr.getIncludesDir(), "./test/stubs/_includes/");
});

test("Invalid override", async (t) => {
  let tr = await getNewTemplateRender("liquid", "./test/stubs");
  await t.assert.rejects(async () => {
    await tr.setEngineOverride("lslkdjf");
  });
});

test("Valid Override", async (t) => {
  let tr = await getNewTemplateRender("liquid", "./test/stubs");
  await tr.setEngineOverride("njk");
  t.assert.strictEqual(tr.getEngineName(), "njk");
  t.assert.ok(tr.isEngine("njk"));
});

test("Parse template syntax into pipeline steps (execution order)", async (t) => {
  t.assert.deepStrictEqual(TemplatePipeline.parse(""), []);
  t.assert.deepStrictEqual(TemplatePipeline.parse(null), []);
  t.assert.deepStrictEqual(TemplatePipeline.parse(undefined), []);
  t.assert.deepStrictEqual(TemplatePipeline.parse(false), []);
  t.assert.deepStrictEqual(TemplatePipeline.parse("html"), []);
  t.assert.deepStrictEqual(TemplatePipeline.parse("html,html"), []);
  t.assert.deepStrictEqual(TemplatePipeline.parse("html,md,md"), ["md"]);
  t.assert.deepStrictEqual(TemplatePipeline.parse("liquid,md"), ["liquid", "md"]);
  t.assert.deepStrictEqual(TemplatePipeline.parse("md,liquid"), ["liquid", "md"]);
  t.assert.deepStrictEqual(TemplatePipeline.parse("liquid"), ["liquid"]);
  t.assert.deepStrictEqual(TemplatePipeline.parse("njk"), ["njk"]);
  t.assert.deepStrictEqual(TemplatePipeline.parse("liquid,html"), ["liquid"]);
  t.assert.deepStrictEqual(TemplatePipeline.parse("liquid,md,html"), ["liquid", "md"]);
  t.assert.deepStrictEqual(TemplatePipeline.parse("njk,njk"), ["njk"]);

  t.assert.throws(() => TemplatePipeline.parse("njk,liquid"));
  t.assert.throws(() => TemplatePipeline.parse("liquid,njk,html"));
});

test("Validate pipeline steps against the allow list", async (t) => {
  t.assert.doesNotThrow(() => TemplatePipeline.validate(["md"]));
  t.assert.doesNotThrow(() => TemplatePipeline.validate(["liquid", "md"]));
  t.assert.doesNotThrow(() => TemplatePipeline.validate(["liquid", "html"]));
  t.assert.doesNotThrow(() => TemplatePipeline.validate(["njk"]));

  t.assert.throws(() => TemplatePipeline.validate(["md", "html"]), { message: /Unsupported template pipeline/ });
  t.assert.throws(() => TemplatePipeline.validate(["md", "liquid"]), { message: /Unsupported template pipeline/ });
  t.assert.throws(() => TemplatePipeline.validate(["liquid", "njk", "md"]), { message: /Only one template engine/ });
});

test("Preprocessing a format with another format throws", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({}, (cfg) => {
    cfg.setHtmlTemplateEngine("md");
  });
  let tr = new TemplateRender("html", eleventyConfig);
  tr.extensionMap = new ExtensionMap(eleventyConfig);
  tr.extensionMap.engineManager = new TemplateEngineManager(eleventyConfig);

  await t.assert.rejects(() => tr.init(), {
    message: "The `htmlTemplateEngine` configuration property must be a template engine, received the output format: md",
  });
});

test("Make sure getEnginesList returns a string", async (t) => {
  let tr = await getNewTemplateRender("liquid", "./test/stubs");
  t.assert.strictEqual(tr.getEnginesList("njk,md"), "njk,md");
});
