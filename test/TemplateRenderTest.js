import test from "ava";

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
  await t.throwsAsync(async () => {
    let tr = await getNewTemplateRender("sldkjfkldsj");
    tr.init("sldkjfkldsj");
  });
});

test("Includes Dir", async (t) => {
  let tr = await getNewTemplateRender("liquid", "./test/stubs");
  t.is(tr.getIncludesDir(), "./test/stubs/_includes/");
});

test("Invalid override", async (t) => {
  let tr = await getNewTemplateRender("liquid", "./test/stubs");
  await t.throwsAsync(async () => {
    await tr.setEngineOverride("lslkdjf");
  });
});

test("Valid Override", async (t) => {
  let tr = await getNewTemplateRender("liquid", "./test/stubs");
  await tr.setEngineOverride("njk");
  t.is(tr.getEngineName(), "njk");
  t.truthy(tr.isEngine("njk"));
});

test("Parse template syntax into pipeline steps (execution order)", async (t) => {
  t.deepEqual(TemplatePipeline.parse(""), []);
  t.deepEqual(TemplatePipeline.parse(null), []);
  t.deepEqual(TemplatePipeline.parse(undefined), []);
  t.deepEqual(TemplatePipeline.parse(false), []);
  t.deepEqual(TemplatePipeline.parse("html"), []);
  t.deepEqual(TemplatePipeline.parse("html,html"), []);
  t.deepEqual(TemplatePipeline.parse("html,md,md"), ["md"]);
  t.deepEqual(TemplatePipeline.parse("liquid,md"), ["liquid", "md"]);
  t.deepEqual(TemplatePipeline.parse("md,liquid"), ["liquid", "md"]);
  t.deepEqual(TemplatePipeline.parse("liquid"), ["liquid"]);
  t.deepEqual(TemplatePipeline.parse("njk"), ["njk"]);
  t.deepEqual(TemplatePipeline.parse("liquid,html"), ["liquid"]);
  t.deepEqual(TemplatePipeline.parse("liquid,md,html"), ["liquid", "md"]);
  t.deepEqual(TemplatePipeline.parse("njk,njk"), ["njk"]);

  t.throws(() => TemplatePipeline.parse("njk,liquid"));
  t.throws(() => TemplatePipeline.parse("liquid,njk,html"));
});

test("Validate pipeline steps against the allow list", async (t) => {
  t.notThrows(() => TemplatePipeline.validate(["md"]));
  t.notThrows(() => TemplatePipeline.validate(["liquid", "md"]));
  t.notThrows(() => TemplatePipeline.validate(["liquid", "html"]));
  t.notThrows(() => TemplatePipeline.validate(["njk"]));

  t.throws(() => TemplatePipeline.validate(["md", "html"]), { message: /Unsupported template pipeline/ });
  t.throws(() => TemplatePipeline.validate(["md", "liquid"]), { message: /Unsupported template pipeline/ });
  t.throws(() => TemplatePipeline.validate(["liquid", "njk", "md"]), { message: /Only one template engine/ });
});

test("Preprocessing a format with another format throws", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({}, (cfg) => {
    cfg.setHtmlTemplateEngine("md");
  });
  let tr = new TemplateRender("html", eleventyConfig);
  tr.extensionMap = new ExtensionMap(eleventyConfig);
  tr.extensionMap.engineManager = new TemplateEngineManager(eleventyConfig);

  await t.throwsAsync(() => tr.init(), {
    message: "The `htmlTemplateEngine` configuration property must be a template engine, received the output format: md",
  });
});

test("Make sure getEnginesList returns a string", async (t) => {
  let tr = await getNewTemplateRender("liquid", "./test/stubs");
  t.is(tr.getEnginesList("njk,md"), "njk,md");
});
