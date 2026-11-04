import test from "node:test";

import TemplateEngine from "../src/Engines/TemplateEngine.js";

import { getTemplateConfigInstance } from "./_testHelpers.js"

test("Unsupported engine", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  let engine = new TemplateEngine("doesnotexist", eleventyConfig);
  t.assert.strictEqual(engine.getName(), "doesnotexist");
});

test("Supported engine", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  t.assert.strictEqual(new TemplateEngine("liquid", eleventyConfig).getName(), "liquid");
});
