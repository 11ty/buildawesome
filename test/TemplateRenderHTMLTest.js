import test from "node:test";
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

// HTML
test("HTML", async (t) => {
  let tr = await getNewTemplateRender("html");
  t.assert.strictEqual(tr.getEngineName(), "html");
});

test("HTML Render", async (t) => {
  let tr = await getNewTemplateRender("html");
  let fn = await tr.getCompiledTemplate("<p>Paragraph</p>");
  t.assert.strictEqual(await fn(), "<p>Paragraph</p>");
  t.assert.strictEqual(await fn({}), "<p>Paragraph</p>");
});

test("HTML Render: Parses HTML using liquid engine (default, with data)", async (t) => {
  let tr = await getNewTemplateRender("html");
  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");
  t.assert.strictEqual((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("HTML Render: Set HTML engine to false, don’t parse", async (t) => {
  let tr = await getNewTemplateRender("html");
  tr.setPreprocessingEngine(false);

  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");
  t.assert.strictEqual((await fn()).trim(), "<h1>{{title}}</h1>");
});

test("HTML Render: Pass in an override (liquid)", async (t) => {
  let tr = await getNewTemplateRender("html");
  tr.setPreprocessingEngine("liquid");
  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");

  t.assert.strictEqual((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});
