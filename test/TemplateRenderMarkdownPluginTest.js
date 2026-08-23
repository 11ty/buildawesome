import test from "ava";
import md from "markdown-it";

import TemplateRender from "../src/TemplateRender.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";

import { getTemplateConfigInstance } from "./_testHelpers.js";

async function getNewTemplateRender(name, inputDir) {
  let eleventyConfig = await getTemplateConfigInstance();

  let tr = new TemplateRender(name, eleventyConfig);
  tr.extensionMap = new ExtensionMap(eleventyConfig);
  tr.extensionMap.engineManager = new TemplateEngineManager(eleventyConfig);
  tr.extensionMap.setFormats([]);
  await tr.init();
  return tr;
}

const createTestMarkdownPlugin = () => {
  const plugin = (md) => {
    md.core.ruler.after("inline", "replace-link", function (state) {
      plugin.environment = state.env;
      const link = state.tokens[1].children[0].attrs[0][1];
      state.tokens[1].children[0].attrs[0][1] = `${link}?data=${state.env.some}`;
      return false;
    });
  };
  plugin.environment = {};
  return plugin;
};

test("Markdown Render: with HTML prerender, sends context data to the markdown library", async (t) => {
  let tr = await getNewTemplateRender("md");

  const plugin = createTestMarkdownPlugin();
  let mdLib = md().use(plugin);
  tr.engine.setLibrary(mdLib);

  const data = { some: "data" };

  let fn = await tr.getCompiledTemplate("[link text](http://link.com)");
  let result = await fn(data);
  t.deepEqual(plugin.environment, data);
  t.is(result, '<p><a href="http://link.com?data=data">link text</a></p>\n');
});

test("Markdown Render: without HTML prerender, sends context data to the markdown library", async (t) => {
  let tr = await getNewTemplateRender("md");

  const plugin = createTestMarkdownPlugin();
  let mdLib = md().use(plugin);
  tr.engine.setLibrary(mdLib);
  tr.setHtmlEngine(false);

  const data = { some: "data" };

  let fn = await tr.getCompiledTemplate("[link text](http://link.com)");
  let result = await fn(data);
  t.deepEqual(plugin.environment, data);
  t.is(result, '<p><a href="http://link.com?data=data">link text</a></p>\n');
});

test("Markdown Render: renderer that only implements the render function", async (t) => {
  let tr = await getNewTemplateRender("md");
  tr.engine.setLibrary({
    render: (content) => {
      const [_, text, href] = content.match(/\[(.*)\]\((.*)\)/);
      return `<p><a href="${href}">${text}</a></p>\n`;
    },
  });
  tr.setHtmlEngine(false);

  let fn = await tr.getCompiledTemplate("[link text](http://link.com)");
  let result = await fn();
  t.is(result, '<p><a href="http://link.com">link text</a></p>\n');
});
