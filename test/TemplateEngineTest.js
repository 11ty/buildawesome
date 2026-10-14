import test from "ava";

import TemplateEngine from "../src/Engines/TemplateEngine.js";

import { getTemplateConfigInstance } from "./_testHelpers.js"

test("Unsupported engine", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  let engine = new TemplateEngine("doesnotexist", eleventyConfig);
  t.is(engine.getName(), "doesnotexist");
});

test("Supported engine", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  t.is(new TemplateEngine("liquid", eleventyConfig).getName(), "liquid");
});
