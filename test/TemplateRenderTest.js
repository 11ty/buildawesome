import test from "ava";

import TemplateRender from "../src/TemplateRender.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";

import { getTemplateConfigInstance } from "./_testHelpers.js";

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

test("Parse Overrides to get Prioritized Engine List", async (t) => {
  t.deepEqual(TemplateRender.parseEngineOverrides(""), []);
  t.deepEqual(TemplateRender.parseEngineOverrides(null), []);
  t.deepEqual(TemplateRender.parseEngineOverrides(undefined), []);
  t.deepEqual(TemplateRender.parseEngineOverrides(false), []);
  t.deepEqual(TemplateRender.parseEngineOverrides("html"), []);
  t.deepEqual(TemplateRender.parseEngineOverrides("html,html"), []);
  t.deepEqual(TemplateRender.parseEngineOverrides("html,md,md"), ["md"]);
  t.deepEqual(TemplateRender.parseEngineOverrides("liquid,md"), ["md", "liquid"]);
  t.deepEqual(TemplateRender.parseEngineOverrides("liquid"), ["liquid"]);
  t.deepEqual(TemplateRender.parseEngineOverrides("njk"), ["njk"]);
  t.deepEqual(TemplateRender.parseEngineOverrides("liquid,html"), ["liquid"]);
  t.deepEqual(TemplateRender.parseEngineOverrides("liquid,md,html"), ["md", "liquid"]);
  t.deepEqual(TemplateRender.parseEngineOverrides("njk,njk"), ["njk"]);

  t.throws(function () {
    TemplateRender.parseEngineOverrides("njk,liquid");
  });
  t.throws(function () {
    TemplateRender.parseEngineOverrides("liquid,njk,html");
  });
});

test("Make sure getEnginesList returns a string", async (t) => {
  let tr = await getNewTemplateRender("liquid", "./test/stubs");
  t.is(tr.getEnginesList("njk,md"), "njk,md");
});
