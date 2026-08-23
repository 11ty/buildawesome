import test from "ava";
import fs from "fs";
import pretty from "pretty";
import TOML from "@iarna/toml";
import * as yaml from "js-yaml";

import TemplateData from "../src/Data/TemplateData.js";
import FileSystemSearch from "../src/FileSystemSearch.js";
import ExtensionMap from "../src/ExtensionMap.js";
import ErrorUtil from "../src/Errors/ErrorUtil.js";
import TemplateContentPrematureUseError from "../src/Errors/TemplateContentPrematureUseError.js";
import { isTypeScriptSupported } from "../src/Util/TypeScriptFeatureTest.cjs";

import { normalizeNewLines } from "./Util/normalizeNewLines.js";
import getNewTemplate from "./_getNewTemplateForTests.js";
import { getRenderedTemplates as getRenderedTmpls, renderLayout, renderTemplate } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";

async function getRenderedData(tmpl, pageNumber = 0) {
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  return templates[pageNumber].data;
}

function cleanHtml(str) {
  return pretty(str, { ocd: true });
}

async function _testCompleteRender(tmpl) {
  let data = await tmpl.getData();
  let entry = await tmpl.getTemplateMapEntry(data);

  entry._pages = await entry.template.getTemplates(entry.data);
  let nestedContent = await Promise.all(
    entry._pages.map(async (page) => {
      page.templateContent = await page.template.renderPageEntryWithoutLayout(page);
      return page.template.renderPageEntry(page);
    })
  );

  let contents = [].concat(...nestedContent);
  return contents;
}

test("getTemplateSubFolder", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");
  t.is(tmpl.getTemplateSubfolder(), "");
});

test("getTemplateSubFolder, output is a subdir of input", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/template.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  t.is(tmpl.getTemplateSubfolder(), "");
});

test("output path maps to an html file", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");
  t.is(tmpl.inputDir, "./test/stubs/");
  t.is(tmpl.outputDir, "./dist/");
  t.is(tmpl.getTemplateSubfolder(), "");

  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/template/index.html");
});

test("subfolder outputs to a subfolder", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/subfolder/subfolder.liquid",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(tmpl.parsed.dir, "./test/stubs/subfolder");
  t.is(tmpl.getTemplateSubfolder(), "subfolder");
  t.is(await tmpl.getOutputPath(data), "./dist/subfolder/index.html");
});

test("subfolder outputs to double subfolder", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/subfolder/subfolder/subfolder.liquid",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(tmpl.parsed.dir, "./test/stubs/subfolder/subfolder");
  t.is(tmpl.getTemplateSubfolder(), "subfolder/subfolder");
  t.is(await tmpl.getOutputPath(data), "./dist/subfolder/subfolder/index.html");
});

test("HTML files output to the same as the input directory have a file suffix added (only if index, this is not index).", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/testing.html", "./test/stubs", "./test/stubs");
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./test/stubs/testing/index.html");
});

test("HTML files output to the same as the input directory have a file suffix added (only if index, this _is_ index).", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/index.html", "./test/stubs", "./test/stubs");
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./test/stubs/index.html");
});

test("HTML files output to the same as the input directory have a file suffix added (only if index, this _is_ index, subfolder).", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/subfolder/index.html",
    "./test/stubs",
    "./test/stubs"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./test/stubs/subfolder/index.html");
});

test("Test raw front matter from template (yaml)", async (t) => {
  // https://github.com/jonschlinkert/gray-matter/blob/master/examples/yaml.js
  let tmpl = await getNewTemplate(
    "./test/stubs/templateFrontMatter.liquid",
    "./test/stubs/",
    "./dist"
  );
  t.truthy(await tmpl.getInputContent(), "template exists and can be opened.");

  t.is((await tmpl._testGetFrontMatter()).data.key1, "value1");
  t.is((await tmpl._testGetFrontMatter()).data.key3, "value3");

  let data = await tmpl.getData();
  t.is(data.key1, "value1");
  t.is(data.key3, "value3");

  let pages = await getRenderedTmpls(tmpl, data);
  t.is(pages[0].templateContent.trim(), "c:value1:value2:value3");
});

test("Test raw front matter from template (json)", async (t) => {
  // https://github.com/jonschlinkert/gray-matter/blob/master/examples/json.js
  let tmpl = await getNewTemplate(
    "./test/stubs/templateFrontMatterJson.liquid",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl._testGetFrontMatter()).data.key1, "value1");
  t.is((await tmpl._testGetFrontMatter()).data.key3, "value3");

  let data = await tmpl.getData();
  t.is(data.key1, "value1");
  t.is(data.key3, "value3");

  let pages = await getRenderedTmpls(tmpl, data);
  t.is(pages[0].templateContent.trim(), "c:value1:value2:value3");
});

test("Test raw front matter from template (js)", async (t) => {
  // https://github.com/jonschlinkert/gray-matter/blob/master/examples/javascript.js
  let tmpl = await getNewTemplate(
    "./test/stubs/templateFrontMatterJs.njk",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl._testGetFrontMatter()).data.key1, "value1");
  t.is((await tmpl._testGetFrontMatter()).data.key3, "value3");

  let data = await tmpl.getData();
  t.is(data.key1, "value1");
  t.is(data.key3, "value3");

  let pages = await getRenderedTmpls(tmpl, data);
  t.is(pages[0].templateContent.trim(), "c:value1:VALUE2:value3");
});

test("Test that getData() works", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/templateFrontMatter.liquid",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();

  t.is(data.key1, "value1");
  t.is(data.key3, "value3");
});

test("One Layout (using new content var)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/templateWithLayoutKey.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  t.is((await tmpl._testGetFrontMatter()).data[tmpl.config.keys.layout], "defaultLayout");

  let data = await tmpl.getData();
  t.is(data[tmpl.config.keys.layout], "defaultLayout");

  t.is(
    normalizeNewLines(cleanHtml(await renderLayout(tmpl, data))),
    `<div id="layout">
  <p>Hello.</p>
</div>`
  );

  t.is(data.keymain, "valuemain");
  t.is(data.keylayout, "valuelayout");
});

test("One Layout (using content)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/templateWithLayoutContent.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  t.is((await tmpl._testGetFrontMatter()).data[tmpl.config.keys.layout], "defaultLayoutLayoutContent");

  let data = await tmpl.getData();
  t.is(data[tmpl.config.keys.layout], "defaultLayoutLayoutContent");

  t.is(
    normalizeNewLines(cleanHtml(await renderLayout(tmpl, data))),
    `<div id="layout">
  <p>Hello.</p>
</div>`
  );

  t.is(data.keymain, "valuemain");
  t.is(data.keylayout, "valuelayout");
});

test("One Layout (layouts disabled)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/templateWithLayoutContent.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  t.is((await tmpl._testGetFrontMatter()).data[tmpl.config.keys.layout], "defaultLayoutLayoutContent");

  let data = await tmpl.getData();
  t.is(data[tmpl.config.keys.layout], "defaultLayoutLayoutContent");

  t.is(cleanHtml(await tmpl.renderPageEntryWithoutLayout({
    rawInput: await tmpl.getPreRender(),
    data: data
  })), "<p>Hello.</p>");

  t.is(data.keymain, "valuemain");
  t.is(data.keylayout, "valuelayout");
});

test("One Layout (liquid test)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/templateWithLayout.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  t.is((await tmpl._testGetFrontMatter()).data[tmpl.config.keys.layout], "layoutLiquid.liquid");

  let data = await tmpl.getData();
  t.is(data[tmpl.config.keys.layout], "layoutLiquid.liquid");

  t.is(
    normalizeNewLines(cleanHtml(await renderLayout(tmpl, data))),
    `<div id="layout">
  <p>Hello.</p>
</div>`
  );

  t.is(data.keymain, "valuemain");
  t.is(data.keylayout, "valuelayout");
});

test("Two Layouts", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/templateTwoLayouts.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  t.is((await tmpl._testGetFrontMatter()).data[tmpl.config.keys.layout], "layout-a");

  let data = await tmpl.getData();
  t.is(data[tmpl.config.keys.layout], "layout-a");
  t.is(data.key1, "value1");

  t.is(
    normalizeNewLines(cleanHtml(await renderLayout(tmpl, data))),
    `<div id="layout-b">
  <div id="layout-a">
    <p>value2-a</p>
  </div>
</div>`
  );

  t.is(data.daysPosted, 152);
});

test("Liquid template", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/formatTest.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  t.is(await renderTemplate(tmpl, await tmpl.getData()), "<p>Zach</p>");
});

test("Liquid template with include", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/includer.liquid", "./test/stubs/", "dist");

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "<p>This is an include.</p>");
});

test("Permalink output directory", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/permalinked.liquid", "./test/stubs/", "./dist");
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/permalinksubfolder/index.html");
});

test("Permalink output directory from layout", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-in-layout.liquid",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/hello/index.html");
});

test("Permalink output directory from layout (fileslug)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-in-layout-fileslug.liquid",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/test/permalink-in-layout-fileslug/index.html");
});

test("Layout from template-data-file that has a permalink (fileslug) Issue #121", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-data-layout/test.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  let renderedTmpl = (await getRenderedTmpls(tmpl, data))[0];
  t.is(renderedTmpl.templateContent, "Wrapper:Test 1:test");
  t.is(await tmpl.getOutputPath(data), "./dist/test/index.html");
});

test("Fileslug in an 11ty.js template Issue #588", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/fileslug.11ty.cjs", "./test/stubs/", "./dist");

  let data = await tmpl.getData();
  let renderedTmpl = (await getRenderedTmpls(tmpl, data))[0];
  t.is(renderedTmpl.templateContent, "<p>fileslug</p>");
});

test("Local template data file import (without a global data json)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/component/component.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  t.deepEqual(await dataObj.getLocalDataPaths(tmpl.getInputPath()), [
    "./test/stubs/stubs.json",

    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.mjs",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/stubs.11tydata.mts",
    "./test/stubs/stubs.11tydata.cts",
    "./test/stubs/stubs.11tydata.ts",

    "./test/stubs/stubs.data.json",
    "./test/stubs/stubs.data.mjs",
    "./test/stubs/stubs.data.cjs",
    "./test/stubs/stubs.data.js",
    "./test/stubs/stubs.data.mts",
    "./test/stubs/stubs.data.cts",
    "./test/stubs/stubs.data.ts",

    "./test/stubs/component/component.json",

    "./test/stubs/component/component.11tydata.json",
    "./test/stubs/component/component.11tydata.mjs",
    "./test/stubs/component/component.11tydata.cjs",
    "./test/stubs/component/component.11tydata.js",
    "./test/stubs/component/component.11tydata.mts",
    "./test/stubs/component/component.11tydata.cts",
    "./test/stubs/component/component.11tydata.ts",

    "./test/stubs/component/component.data.json",
    "./test/stubs/component/component.data.mjs",
    "./test/stubs/component/component.data.cjs",
    "./test/stubs/component/component.data.js",
    "./test/stubs/component/component.data.mts",
    "./test/stubs/component/component.data.cts",
    "./test/stubs/component/component.data.ts",
  ]);
  t.is(data.localdatakey1, "localdatavalue1");
  t.is(await renderTemplate(tmpl, data), "localdatavalue1");
});

test("Local template data file import (two subdirectories deep)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/firstdir/seconddir/component.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  t.deepEqual(await dataObj.getLocalDataPaths(tmpl.getInputPath()), [
    "./test/stubs/stubs.json",

    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.mjs",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/stubs.11tydata.mts",
    "./test/stubs/stubs.11tydata.cts",
    "./test/stubs/stubs.11tydata.ts",

    "./test/stubs/stubs.data.json",
    "./test/stubs/stubs.data.mjs",
    "./test/stubs/stubs.data.cjs",
    "./test/stubs/stubs.data.js",
    "./test/stubs/stubs.data.mts",
    "./test/stubs/stubs.data.cts",
    "./test/stubs/stubs.data.ts",

    "./test/stubs/firstdir/firstdir.json",

    "./test/stubs/firstdir/firstdir.11tydata.json",
    "./test/stubs/firstdir/firstdir.11tydata.mjs",
    "./test/stubs/firstdir/firstdir.11tydata.cjs",
    "./test/stubs/firstdir/firstdir.11tydata.js",
    "./test/stubs/firstdir/firstdir.11tydata.mts",
    "./test/stubs/firstdir/firstdir.11tydata.cts",
    "./test/stubs/firstdir/firstdir.11tydata.ts",

    "./test/stubs/firstdir/firstdir.data.json",
    "./test/stubs/firstdir/firstdir.data.mjs",
    "./test/stubs/firstdir/firstdir.data.cjs",
    "./test/stubs/firstdir/firstdir.data.js",
    "./test/stubs/firstdir/firstdir.data.mts",
    "./test/stubs/firstdir/firstdir.data.cts",
    "./test/stubs/firstdir/firstdir.data.ts",

    "./test/stubs/firstdir/seconddir/seconddir.json",

    "./test/stubs/firstdir/seconddir/seconddir.11tydata.json",
    "./test/stubs/firstdir/seconddir/seconddir.11tydata.mjs",
    "./test/stubs/firstdir/seconddir/seconddir.11tydata.cjs",
    "./test/stubs/firstdir/seconddir/seconddir.11tydata.js",
    "./test/stubs/firstdir/seconddir/seconddir.11tydata.mts",
    "./test/stubs/firstdir/seconddir/seconddir.11tydata.cts",
    "./test/stubs/firstdir/seconddir/seconddir.11tydata.ts",

    "./test/stubs/firstdir/seconddir/seconddir.data.json",
    "./test/stubs/firstdir/seconddir/seconddir.data.mjs",
    "./test/stubs/firstdir/seconddir/seconddir.data.cjs",
    "./test/stubs/firstdir/seconddir/seconddir.data.js",
    "./test/stubs/firstdir/seconddir/seconddir.data.mts",
    "./test/stubs/firstdir/seconddir/seconddir.data.cts",
    "./test/stubs/firstdir/seconddir/seconddir.data.ts",

    "./test/stubs/firstdir/seconddir/component.json",

    "./test/stubs/firstdir/seconddir/component.11tydata.json",
    "./test/stubs/firstdir/seconddir/component.11tydata.mjs",
    "./test/stubs/firstdir/seconddir/component.11tydata.cjs",
    "./test/stubs/firstdir/seconddir/component.11tydata.js",
    "./test/stubs/firstdir/seconddir/component.11tydata.mts",
    "./test/stubs/firstdir/seconddir/component.11tydata.cts",
    "./test/stubs/firstdir/seconddir/component.11tydata.ts",

    "./test/stubs/firstdir/seconddir/component.data.json",
    "./test/stubs/firstdir/seconddir/component.data.mjs",
    "./test/stubs/firstdir/seconddir/component.data.cjs",
    "./test/stubs/firstdir/seconddir/component.data.js",
    "./test/stubs/firstdir/seconddir/component.data.mts",
    "./test/stubs/firstdir/seconddir/component.data.cts",
    "./test/stubs/firstdir/seconddir/component.data.ts",
  ]);
});

test("Posts inherits local JSON, layouts", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/posts/post1.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let localDataPaths = await dataObj.getLocalDataPaths(tmpl.getInputPath());
  t.deepEqual(localDataPaths, [
    "./test/stubs/stubs.json",

    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.mjs",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/stubs.11tydata.mts",
    "./test/stubs/stubs.11tydata.cts",
    "./test/stubs/stubs.11tydata.ts",

    "./test/stubs/stubs.data.json",
    "./test/stubs/stubs.data.mjs",
    "./test/stubs/stubs.data.cjs",
    "./test/stubs/stubs.data.js",
    "./test/stubs/stubs.data.mts",
    "./test/stubs/stubs.data.cts",
    "./test/stubs/stubs.data.ts",

    "./test/stubs/posts/posts.json",

    "./test/stubs/posts/posts.11tydata.json",
    "./test/stubs/posts/posts.11tydata.mjs",
    "./test/stubs/posts/posts.11tydata.cjs",
    "./test/stubs/posts/posts.11tydata.js",
    "./test/stubs/posts/posts.11tydata.mts",
    "./test/stubs/posts/posts.11tydata.cts",
    "./test/stubs/posts/posts.11tydata.ts",

    "./test/stubs/posts/posts.data.json",
    "./test/stubs/posts/posts.data.mjs",
    "./test/stubs/posts/posts.data.cjs",
    "./test/stubs/posts/posts.data.js",
    "./test/stubs/posts/posts.data.mts",
    "./test/stubs/posts/posts.data.cts",
    "./test/stubs/posts/posts.data.ts",

    "./test/stubs/posts/post1.json",

    "./test/stubs/posts/post1.11tydata.json",
    "./test/stubs/posts/post1.11tydata.mjs",
    "./test/stubs/posts/post1.11tydata.cjs",
    "./test/stubs/posts/post1.11tydata.js",
    "./test/stubs/posts/post1.11tydata.mts",
    "./test/stubs/posts/post1.11tydata.cts",
    "./test/stubs/posts/post1.11tydata.ts",

    "./test/stubs/posts/post1.data.json",
    "./test/stubs/posts/post1.data.mjs",
    "./test/stubs/posts/post1.data.cjs",
    "./test/stubs/posts/post1.data.js",
    "./test/stubs/posts/post1.data.mts",
    "./test/stubs/posts/post1.data.cts",
    "./test/stubs/posts/post1.data.ts",
  ]);

  let localData = await dataObj.getTemplateDirectoryData(tmpl.getInputPath());
  t.is(localData.layout, "mylocallayout.njk");

  let globalData = await dataObj.getGlobalData();
  t.truthy(globalData.pkg);

  let data = await tmpl.getData();
  t.is(localData.layout, "mylocallayout.njk");

  t.is(
    normalizeNewLines((await renderTemplate(tmpl, data)).trim()),
    `<div id="locallayout">Post1
</div>`
  );
});

test("Template and folder name are the same, make sure data imports work ok", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist"
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/posts/posts.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let localDataPaths = await dataObj.getLocalDataPaths(tmpl.getInputPath());
  t.deepEqual(localDataPaths, [
    "./test/stubs/stubs.json",

    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.mjs",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/stubs.11tydata.mts",
    "./test/stubs/stubs.11tydata.cts",
    "./test/stubs/stubs.11tydata.ts",

    "./test/stubs/stubs.data.json",
    "./test/stubs/stubs.data.mjs",
    "./test/stubs/stubs.data.cjs",
    "./test/stubs/stubs.data.js",
    "./test/stubs/stubs.data.mts",
    "./test/stubs/stubs.data.cts",
    "./test/stubs/stubs.data.ts",

    "./test/stubs/posts/posts.json",

    "./test/stubs/posts/posts.11tydata.json",
    "./test/stubs/posts/posts.11tydata.mjs",
    "./test/stubs/posts/posts.11tydata.cjs",
    "./test/stubs/posts/posts.11tydata.js",
    "./test/stubs/posts/posts.11tydata.mts",
    "./test/stubs/posts/posts.11tydata.cts",
    "./test/stubs/posts/posts.11tydata.ts",

    "./test/stubs/posts/posts.data.json",
    "./test/stubs/posts/posts.data.mjs",
    "./test/stubs/posts/posts.data.cjs",
    "./test/stubs/posts/posts.data.js",
    "./test/stubs/posts/posts.data.mts",
    "./test/stubs/posts/posts.data.cts",
    "./test/stubs/posts/posts.data.ts",
  ]);

  let localData = await dataObj.getTemplateDirectoryData(tmpl.getInputPath());
  t.is(localData.layout, "mylocallayout.njk");

  let globalData = await dataObj.getGlobalData();
  t.truthy(globalData.pkg);

  let data = await tmpl.getData();
  t.is(localData.layout, "mylocallayout.njk");

  t.is(
    normalizeNewLines((await renderTemplate(tmpl, data)).trim()),
    `<div id="locallayout">Posts
</div>`
  );
});

test("Clone the template", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/default.liquid", "./test/stubs/", "./dist");

  let data = await tmpl.getData();

  let cloned = await tmpl.clone();
  let clonedData = await cloned.getData();

  t.is(await tmpl.getOutputPath(data), "./dist/default/index.html");
  t.is(await cloned.getOutputPath(clonedData), "./dist/default/index.html");
  t.is(cloned.extensionMap, tmpl.extensionMap);
});

test("getRenderedData() has all the page variables", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);

  t.truthy(data.page.url);
  t.is(data.page.url, "/template/");
  t.is(data.page.fileSlug, "template");
  t.is(data.page.filePathStem, "/template");
  t.truthy(data.page.date.getTime());
  t.is(data.page.inputPath, "./test/stubs/template.liquid");
  t.is(data.page.outputPath, "./dist/template/index.html");
});

test("Issue #603: page.date Liquid", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/pagedate.liquid", "./test/stubs/", "./dist");
  let data = await tmpl.getData();

  t.truthy(data.page.date);
  t.truthy(data.page.date.toUTCString());

  let pages = await getRenderedTmpls(tmpl, data);
  t.is(pages[0].templateContent.trim(), data.page.date.toString());
});

test("Issue #603: page.date Nunjucks", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/pagedate.njk", "./test/stubs/", "./dist");
  let data = await tmpl.getData();

  t.truthy(data.page.date);
  t.truthy(data.page.date.toUTCString());

  let pages = await getRenderedTmpls(tmpl, data);
  t.is(pages[0].templateContent.trim(), data.page.date.toString());
});

test("Issue #603: page.date.toUTCString() Nunjucks", async (t) => {
  // Note this is not supported in Liquid
  let tmpl = await getNewTemplate("./test/stubs/pagedateutc.njk", "./test/stubs/", "./dist");
  let data = await tmpl.getData();

  t.truthy(data.page.date);
  t.truthy(data.page.date.toUTCString());

  let pages = await getRenderedTmpls(tmpl, data);
  t.is(pages[0].templateContent.trim(), data.page.date.toUTCString());
});

test("getTemplates() data has all the root variables", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.is(templates[0].url, "/template/");
  t.is(templates[0].fileSlug, "template");
  t.is(templates[0].filePathStem, "/template");
  t.truthy(templates[0].date.getTime());
  t.is(templates[0].inputPath, "./test/stubs/template.liquid");
  t.is(templates[0].outputPath, "./dist/template/index.html");
});

test("getTemplates() data has all the page variables", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.is(templates[0].data.page.url, "/template/");
  t.is(templates[0].data.page.fileSlug, "template");
  t.is(templates[0].filePathStem, "/template");
  t.truthy(templates[0].data.page.date.getTime());
  t.is(templates[0].data.page.inputPath, "./test/stubs/template.liquid");
  t.is(templates[0].data.page.outputPath, "./dist/template/index.html");
});

// Warning `getRenderedTemplates()` is a test function now, so this might be a test testing the tests
test("getRenderedTemplates() data has all the page variables", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");
  let data = await tmpl.getData();

  let templates = await getRenderedTmpls(tmpl, data);
  t.is(templates[0].data.page.url, "/template/");
  t.is(templates[0].data.page.fileSlug, "template");
  t.is(templates[0].filePathStem, "/template");
  t.truthy(templates[0].data.page.date.getTime());
  t.is(templates[0].data.page.inputPath, "./test/stubs/template.liquid");
  t.is(templates[0].data.page.outputPath, "./dist/template/index.html");
});

test("getRenderedData() has good slug (empty, index)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/index.liquid", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  t.is(data.page.fileSlug, "");
  t.is(data.page.filePathStem, "/index");
});

test("getRenderedData() has good slug", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/includer.liquid", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  t.is(data.page.fileSlug, "includer");
  t.is(data.page.filePathStem, "/includer");
});

test("Override base templating engine from .liquid to njk", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/test-njk.liquid",
    "./test/stubs/",
    "./dist"
  );

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "My Title");
});

test("Override base templating engine from markdown to 11ty.js, then markdown", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/test-override-js-markdown.11ty.cjs",
    "./test/stubs/",
    "./dist"
  );

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "<h1>This is markdown</h1>");
});

test("Override base templating engine from .liquid to md", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/test-md.liquid",
    "./test/stubs/",
    "./dist"
  );

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "<h1>My Title</h1>");
});

test("Override base templating engine from .liquid to njk,md", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/test-multiple.md",
    "./test/stubs/",
    "./dist"
  );

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "<h1>My Title</h1>");
});

test("Override base templating engine from .njk to liquid,md", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/test-multiple2.njk",
    "./test/stubs/",
    "./dist"
  );

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "<h1>My Title</h1>");
});

test("Override base templating engine from .html to njk", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/overrides/test.html", "./test/stubs/", "./dist");

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "<h2>My Title</h2>");
});

test("Override base templating engine from .html to (nothing)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/test-empty.html",
    "./test/stubs/",
    "./dist"
  );

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "<h2>{{ title }}</h2>");
});

test("Override base templating engine should error with bad string", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/test-error.njk",
    "./test/stubs/",
    "./dist"
  );

  await t.throwsAsync(async () => {
    await renderTemplate(tmpl, await tmpl.getData());
  });
});

test("Override base templating engine (bypasses markdown)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/test-bypass.md",
    "./test/stubs/",
    "./dist"
  );

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "# My Title");
});

test("Override base templating engine to (nothing)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/test-empty.md",
    "./test/stubs/",
    "./dist"
  );

  // not parsed
  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "# {{ title }}");
});

test("Override base templating engine from .njk to liquid (with a layout that uses njk)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/overrides/layout.njk", "./test/stubs/", "./dist");

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), `<div id="layoutvalue"><h2>8</h2></div>`);
});

test("Override base templating engine from .njk to nothing (with a layout that uses njk)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/layoutfalse.njk",
    "./test/stubs/",
    "./dist"
  );

  t.is(
    (await renderTemplate(tmpl, await tmpl.getData())).trim(),
    `<div id="layoutvalue"><h2><%= title %></h2></div>`
  );
});

test("Using a markdown source file (with a layout that uses njk), markdown shouldn’t render in layout file", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/overrides/test.md", "./test/stubs/", "./dist");

  t.is(
    normalizeNewLines((await renderTemplate(tmpl, await tmpl.getData())).trim()),
    `# Layout header

<div id="layoutvalue"><h1>My Title</h1>
</div>`
  );
});

test("renderDirect on a markdown file, permalink should not render markdown", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/permalink-markdown.md", "./test/stubs/", "./dist");
  let data = await tmpl.getData();
  t.is(
    await tmpl.renderDirect("/news/my-test-file/index.html", {}, true),
    "/news/my-test-file/index.html"
  );

  t.is(await tmpl.getRawOutputPath(data), "/news/my-test-file/index.html");
});

test("renderDirect on a markdown file, permalink should not render markdown (with variable)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-markdown-var.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(
    await tmpl.renderDirect("/news/{{ slug }}/index.html", { slug: "my-title" }, true),
    "/news/my-title/index.html"
  );

  t.is(await tmpl.getRawOutputPath(data), "/news/my-title/index.html");
});

test("renderDirect on a markdown file, permalink should not render markdown (has override)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-markdown-override.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(
    await tmpl.renderDirect("/news/my-test-file/index.html", {}, true),
    "/news/my-test-file/index.html"
  );

  t.is(await tmpl.getRawOutputPath(data), "/news/my-test-file/index.html");
});

/* Transforms */
test("Test a transform", async (t) => {
  t.plan(2);

  let tmpl = await getNewTemplate(
    "./test/stubs/template.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.setTransforms({
    transformName: function (content, outputPath) {
      t.true(outputPath.endsWith(".html"));
      return "OVERRIDE BY A TRANSFORM";
    }
  });

  let renders = await _testCompleteRender(tmpl);
  t.is(renders[0], "OVERRIDE BY A TRANSFORM");
});

// #789: https://github.com/11ty/eleventy/issues/789
test("Test a transform (does it have this.inputPath?)", async (t) => {
  t.plan(3);

  let tmpl = await getNewTemplate(
    "./test/stubs/template.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.setTransforms({
    transformName: function (content, outputPath) {
      t.true(outputPath.endsWith(".html"));
      t.true(!!this.inputPath);
      return "OVERRIDE BY A TRANSFORM";
    }
  });

  let renders = await _testCompleteRender(tmpl);
  t.is(renders[0], "OVERRIDE BY A TRANSFORM");
});

test("Test a transform with pages", async (t) => {
  t.plan(5);

  let tmpl = await getNewTemplate(
    "./test/stubs/transform-pages/template.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.setTransforms({
    transformName: function (content, outputPath) {
      // should run twice, one for each page
      t.true(content.length > 0);
      t.true(outputPath.endsWith(".html"));
      return "OVERRIDE BY A TRANSFORM";
    }
  });

  let renders = await _testCompleteRender(tmpl);
  t.is(renders[0], "OVERRIDE BY A TRANSFORM");
});

test("Test a transform with a layout", async (t) => {
  t.plan(3);

  let tmpl = await getNewTemplate(
    "./test/stubs-475/transform-layout/transform-layout.njk",
    "./test/stubs-475/",
    "./test/stubs-475/_site"
  );

  tmpl.setTransforms({
    transformName: function (content, outputPath) {
      t.is(content, "<html><body>This is content.</body></html>");
      t.true(outputPath.endsWith(".html"));
      return "OVERRIDE BY A TRANSFORM";
    }
  });

  let renders = await _testCompleteRender(tmpl);
  t.is(renders[0], "OVERRIDE BY A TRANSFORM");
});

test("Test a single asynchronous transform", async (t) => {
  t.plan(2);

  let tmpl = await getNewTemplate(
    "./test/stubs/template.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.setTransforms({
    transformName: async function (content, outputPath) {
      t.true(outputPath.endsWith("template/index.html"));

      return new Promise((resolve) => {
        setTimeout(function (str, outputPath) {
          resolve("OVERRIDE BY A TRANSFORM");
        }, 50);
      });
    }
  });

  let renders = await _testCompleteRender(tmpl);
  t.is(renders[0], "OVERRIDE BY A TRANSFORM");
});

test("Test multiple asynchronous transforms", async (t) => {
  t.plan(3);

  let tmpl = await getNewTemplate(
    "./test/stubs/template.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.setTransforms({
    transformName1: async function (content, outputPath) {
      t.true(outputPath.endsWith("template/index.html"));

      return new Promise((resolve, reject) => {
        setTimeout(function (str, outputPath) {
          resolve("lowercase transform");
        }, 50);
      });
    },
    // uppercase
    transformName2: async function (str, outputPath) {
      t.true(outputPath.endsWith("template/index.html"));

      return new Promise((resolve, reject) => {
        setTimeout(function () {
          resolve(str.toUpperCase());
        }, 50);
      });
    }
  });

  let renders = await _testCompleteRender(tmpl);
  t.is(renders[0], "LOWERCASE TRANSFORM");
});

test("Test a linter", async (t) => {
  t.plan(4);

  let tmpl = await getNewTemplate(
    "./test/stubs/transform-pages/template.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.addLinter(function (str, inputPath, outputPath) {
    t.true(inputPath.endsWith("template.njk"));
    t.true(outputPath.endsWith("index.html"));
  });

  await _testCompleteRender(tmpl);
});

test("Front Matter Tags (Single)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/templatetest-frontmatter/single.njk",
    "./test/stubs/",
    "dist"
  );
  let { data: frontmatter } = await tmpl.getFrontMatterData();
  t.deepEqual(frontmatter.tags, ["single-tag"]);

  let fulldata = await tmpl.getData();
  t.deepEqual(fulldata.tags, ["single-tag"]);

  let pages = await getRenderedTmpls(tmpl, fulldata);
  t.is(pages[0].templateContent.trim(), "Has single-tag");
});

test("Front Matter Tags (Multiple)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/templatetest-frontmatter/multiple.njk",
    "./test/stubs/",
    "dist"
  );
  let { data: frontmatter } = await tmpl.getFrontMatterData();
  t.deepEqual(frontmatter.tags, ["multi-tag", "multi-tag-2"]);

  let fulldata = await tmpl.getData();
  t.deepEqual(fulldata.tags, ["multi-tag", "multi-tag-2"]);

  let pages = await getRenderedTmpls(tmpl, fulldata);
  t.is(pages[0].templateContent.trim(), "Has multi-tag-2");
});

test("Front matter date with quotes (liquid), issue #258", async (t) => {
let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/frontmatter-date/test.liquid",
    output: "dist"
  }, function(cfg) {
    const YAML_SCHEMA = yaml.CORE_SCHEMA.withTags(yaml.timestampTag);
    const YAML_LOAD = (str, options) => yaml.load(str, Object.assign({ schema: YAML_SCHEMA }, options));

    cfg.setFrontMatterParsingOptions({
      engines: {
        yaml: YAML_LOAD,
      }
    })
  });

  let dataObj = new TemplateData(eleventyConfig);
  let tmpl = await getNewTemplate(
    "./test/stubs/frontmatter-date/test.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(data.mydate.toISOString(), "2009-04-15T11:34:34.000Z");

  let pages = await getRenderedTmpls(tmpl, data);
  t.is(pages[0].templateContent.trim(), "2009-04-15");
});

test("Front matter date with quotes (njk), issue #258", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/frontmatter-date/test.njk",
    output: "dist"
  }, function(cfg) {
    const YAML_SCHEMA = yaml.CORE_SCHEMA.withTags(yaml.timestampTag);
    const YAML_LOAD = (str, options) => yaml.load(str, Object.assign({ schema: YAML_SCHEMA }, options));

    cfg.setFrontMatterParsingOptions({
      engines: {
        yaml: YAML_LOAD,
      }
    })
  });

  let dataObj = new TemplateData(eleventyConfig);
  let tmpl = await getNewTemplate(
    "./test/stubs/frontmatter-date/test.njk",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(data.mydate.toISOString(), "2009-04-15T00:34:34.000Z");

  let pages = await getRenderedTmpls(tmpl, data);
  t.is(pages[0].templateContent.trim(), "2009-04-15T00:34:34.000Z");
});

test("Data Cascade (Deep merge)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test",
    output: "dist"
  }, function(cfg) {
    // Default changed in 1.0
    // cfg.setDataDeepMerge(true);
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/data-cascade/template.njk",
    "./test/",
    "./dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.deepEqual(Object.keys(data).sort(), [
    "buildawesome",
    "datafile",
    "eleventy",
    "frontmatter",
    "page",
    "parent",
    "pkg",
    "tags",
  ]);

  t.deepEqual(Object.keys(data.parent).sort(), ["child", "datafile", "frontmatter"]);

  t.is(data.parent.child, -2);
});

test("Data Cascade Tag Merge (Deep merge)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist"
  }, function(cfg) {
    // Default changed in 1.0
    // cfg.setDataDeepMerge(true);
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/data-cascade/template.njk",
    "./test/stubs/",
    "./dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.deepEqual(data.tags.sort(), ["tagA", "tagB", "tagC", "tagD"]);
});

test("Data Cascade Tag Merge (Deep Merge - Deduplication)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist"
  }, function(cfg) {
    // Default changed in 1.0
    // cfg.setDataDeepMerge(true);
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/data-cascade/template.njk",
    "./test/stubs/",
    "./dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.deepEqual(data.tags.sort(), ["tagA", "tagB", "tagC", "tagD"]);
});

test('Local data inherits tags string ([tags] vs "tags") Deep Merge', async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist"
  }, function(cfg) {
    // Default changed in 1.0
    // cfg.setDataDeepMerge(true);
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/local-data-tags/component.njk",
    "./test/stubs/",
    "./dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.deepEqual(data.tags.sort(), ["tag1", "tag2", "tag3"]);
});

test("Throws a Premature Template Content Error (njk)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/prematureTemplateContent/test.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(ErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error from rendering (njk)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/prematureTemplateContent/test.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  await tmpl.getTemplateMapEntry(data);

  let pageEntries = await tmpl.getTemplates({
    page: {},
    sample: {
      get templateContent() {
        throw new TemplateContentPrematureUseError(
          "Tried to use templateContent too early (test.njk)"
        );
      },
    },
  });
  let error = await t.throwsAsync(async () => {
    await tmpl.renderPageEntry(pageEntries[0]);
  });
  t.is(ErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (liquid)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/prematureTemplateContent/test.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(ErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (11ty.js)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/prematureTemplateContent/test.11ty.cjs",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(ErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (md)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/prematureTemplateContent/test.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(ErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error from rendering (md)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/prematureTemplateContent/test.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  await tmpl.getTemplateMapEntry(data);

  let pageEntries = await tmpl.getTemplates({
    page: {},
    sample: {
      get templateContent() {
        throw new TemplateContentPrematureUseError(
          "Tried to use templateContent too early (test.md)"
        );
      },
    },
  });
  let error = await t.throwsAsync(async () => {
    await tmpl.renderPageEntry(pageEntries[0]);
  });
  t.is(ErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Issue 413 weird date format", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs-413/date-frontmatter.md",
    "./test/stubs-413/",
    "./dist"
  );

  await t.throwsAsync(async function () {
    await tmpl.getData();
  }, {
    message: "Data cascade value for `date` (2019-03-13 20:18:42 +0000) is invalid for ./test/stubs-413/date-frontmatter.md"
  });
});

test("Custom Front Matter Parsing Options", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({}, function(cfg) {
    cfg.setFrontMatterParsingOptions({
      excerpt: true,
    })
  });
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-frontmatter/template.njk",
    "./test/stubs/",
    "./dist",
    undefined,
    undefined,
    eleventyConfig,
  );

  let frontmatter = await tmpl._testGetFrontMatter();

  t.is(frontmatter.data.front, "hello");

  t.is(frontmatter.excerpt.trim(), "This is an excerpt.");
  t.is(
    normalizeNewLines(frontmatter.content.trim()),
    `This is an excerpt.
This is content.`
  );

  let fulldata = await tmpl.getData();
  t.is(fulldata.page.excerpt.trim(), "This is an excerpt.");
});

test("Custom Front Matter Parsing Options (using alias)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({}, function(cfg) {
    cfg.setFrontMatterParsingOptions({
      excerpt: true,
      excerpt_alias: "my_excerpt",
    })
  });

  let tmpl = await getNewTemplate(
    "./test/stubs/custom-frontmatter/template.njk",
    "./test/stubs/",
    "./dist",
    undefined,
    undefined,
    eleventyConfig,
  );

  let frontmatter = await tmpl._testGetFrontMatter();
  t.is(frontmatter.data.front, "hello");

  t.is(
    normalizeNewLines(frontmatter.content.trim()),
    `This is an excerpt.
This is content.`
  );

  let fulldata = await tmpl.getData();
  t.is(fulldata.my_excerpt.trim(), "This is an excerpt.");
});

test("Custom Front Matter Parsing Options (no newline before excerpt separator)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({}, function(cfg) {
    cfg.setFrontMatterParsingOptions({
      excerpt: true,
    })
  });
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-frontmatter/template-newline1.njk",
    "./test/stubs/",
    "./dist",
    undefined,
    undefined,
    eleventyConfig,
  );

  let frontmatter = await tmpl._testGetFrontMatter();
  t.is(frontmatter.data.front, "hello");

  t.is(frontmatter.excerpt.trim(), "This is an excerpt.");
  t.is(
    normalizeNewLines(frontmatter.content.trim()),
    `This is an excerpt.
This is content.`
  );

  let fulldata = await tmpl.getData();
  t.is(fulldata.page.excerpt.trim(), "This is an excerpt.");
});

test("Custom Front Matter Parsing Options (no newline after excerpt separator)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({}, function(cfg) {
    cfg.setFrontMatterParsingOptions({
      excerpt: true,
    })
  });
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-frontmatter/template-newline3.njk",
    "./test/stubs/",
    "./dist",
    undefined,
    undefined,
    eleventyConfig,
  );

  let frontmatter = await tmpl._testGetFrontMatter();
  t.is(
    normalizeNewLines(frontmatter.content.trim()),
    `This is an excerpt.
This is content.`
  );
});

test("Custom Front Matter Parsing Options (no newlines before or after excerpt separator)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({}, function(cfg) {
    cfg.setFrontMatterParsingOptions({
      excerpt: true,
    })
  });

  let tmpl = await getNewTemplate(
    "./test/stubs/custom-frontmatter/template-newline2.njk",
    "./test/stubs/",
    "./dist",
    undefined,
    undefined,
    eleventyConfig
  );

  let frontmatter = await tmpl._testGetFrontMatter();
  t.is(frontmatter.content.trim(), "This is an excerpt.This is content.");
});

test("Custom Front Matter Parsing Options (html comment separator)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({}, function(cfg) {
    cfg.setFrontMatterParsingOptions({
      excerpt: true,
      excerpt_separator: "<!-- excerpt -->",
    })
  });
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-frontmatter/template-excerpt-comment.njk",
    "./test/stubs/",
    "./dist",
    undefined,
    undefined,
    eleventyConfig
  );

  let frontmatter = await tmpl._testGetFrontMatter();
  t.is(frontmatter.data.front, "hello");

  t.is(frontmatter.excerpt.trim(), "This is an excerpt.");
  t.is(
    normalizeNewLines(frontmatter.content.trim()),
    `This is an excerpt.
This is content.`
  );

  let fulldata = await tmpl.getData();
  t.is(fulldata.page.excerpt.trim(), "This is an excerpt.");
});

test("Custom Front Matter Parsing Options (using TOML)", async (t) => {
  // Currently fails on Windows, needs https://github.com/jonschlinkert/gray-matter/issues/92
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-frontmatter/template-toml.njk",
    "./test/stubs/",
    "./dist"
  );
  tmpl.config.frontMatterParsingOptions = {
    engines: {
      toml: TOML.parse.bind(TOML),
    },
  };

  let frontmatter = await tmpl._testGetFrontMatter();
  t.deepEqual(frontmatter.data, {
    front: "hello",
  });
  t.is(frontmatter.content.trim(), "This is content.");

  let fulldata = await tmpl.getData();
  t.is(fulldata.front, "hello");
});

test("global variable with dashes Issue #567 (liquid)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/global-dash-variable.liquid",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  t.is(data["is-it-tasty"], "Yes");

  let pages = await getRenderedTmpls(tmpl, data);
  t.is(pages[0].templateContent.trim(), "Yes");
});

test("Issue #446: Layout has a permalink with a different template language than content", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/layout-permalink-difflang/test.md",
    "./test/stubs/layout-permalink-difflang/",
    "dist"
  );

  let data = await tmpl.getData();
  // this call is needed for page data to be added
  let pages = await getRenderedTmpls(tmpl, data);

  t.is(data.permalink, "/{{ page.fileSlug }}/");
  t.is(data.page.url, "/test/");
});

test("Get Layout Chain", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs-incremental/layout-chain/test.njk",
    "./test/stubs-incremental/layout-chain/",
    "./dist"
  );

  let data = await tmpl.getData();
  let layout = tmpl.getLayout(data.layout);

  t.deepEqual(await layout.getLayoutChain(), [
    "./test/stubs-incremental/layout-chain/_includes/base.njk",
    "./test/stubs-incremental/layout-chain/_includes/parent.njk",
  ]);
});

test("Engine Singletons", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/engine-singletons",
      output: "dist"
    }
  });

  let map = new ExtensionMap(eleventyConfig);
  map.engineManager = new TemplateEngineManager(eleventyConfig);
  map.setFormats(["njk"]);
  let tmpl1 = await getNewTemplate(
    "./test/stubs/engine-singletons/first.njk",
    "./test/stubs/engine-singletons/",
    "./dist",
    null,
    map,
    eleventyConfig
  );
  let tmpl2 = await getNewTemplate(
    "./test/stubs/engine-singletons/second.njk",
    "./test/stubs/engine-singletons/",
    "./dist",
    null,
    map,
    eleventyConfig
  );

  t.deepEqual(tmpl1.engine, tmpl2.engine);
});

test("Make sure layout cache takes new changes during watch (nunjucks)", async (t) => {
  let filePath = "./test/stubs-layout-cache/_includes/include-script-1.js";

  fs.writeFileSync(filePath, `alert("hi");`, "utf8");

  let tmpl = await getNewTemplate(
    "./test/stubs-layout-cache/test.njk",
    "./test/stubs-layout-cache/",
    "./dist"
  );

  let data = await tmpl.getData();

  t.is((await renderTemplate(tmpl, data)).trim(), '<script>alert("hi");</script>');

  fs.writeFileSync(filePath, `alert("bye");`, "utf8");

  tmpl.config.events.emit("buildawesome#templatemodified", filePath);

  t.is((await renderTemplate(tmpl, data)).trim(), '<script>alert("bye");</script>');
});

test("Make sure layout cache takes new changes during watch (liquid)", async (t) => {
  let filePath = "./test/stubs-layout-cache/_includes/include-script-2.js";
  fs.writeFileSync(filePath, `alert("hi");`, "utf8");

  let tmpl = await getNewTemplate(
    "./test/stubs-layout-cache/test.liquid",
    "./test/stubs-layout-cache/",
    "./dist"
  );

  let data = await tmpl.getData();

  t.is((await renderTemplate(tmpl, data)).trim(), '<script>alert("hi");</script>');

  fs.writeFileSync(filePath, `alert("bye");`, "utf8");

  // Trigger that the file has changed
  tmpl.internalTriggerTemplateModifiedPath(filePath);

  t.is((await renderTemplate(tmpl, data)).trim(), '<script>alert("bye");</script>');
});

test("Add Extension via Configuration (txt file)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist"
  }, function(cfg) {
    cfg.addExtension("txt", {
      isIncrementalMatch: function (incrementalFilePath) {
        // do some kind of check
        return this.inputPath === incrementalFilePath;
      },
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let map = new ExtensionMap(eleventyConfig);
  map.engineManager = new TemplateEngineManager(eleventyConfig);
  map.setFormats([]);
  let tmpl = await getNewTemplate(
    "./test/stubs/default.txt",
    "./test/stubs/",
    "./dist",
    null,
    map,
    eleventyConfig
  );

  let extensions = tmpl.getExtensionEntries();
  t.deepEqual(extensions[0].key, "txt");
  t.deepEqual(extensions[0].extension, "txt");

  t.truthy(tmpl.isFileRelevantToThisTemplate("./test/stubs/default.txt"));
  t.falsy(tmpl.isFileRelevantToThisTemplate("./test/stubs/default2.txt"));
  t.falsy(tmpl.isFileRelevantToThisTemplate("./test/stubs/default.njk"));

  t.truthy(
    tmpl.isFileRelevantToThisTemplate("./test/stubs/default.txt", {
      isFullTemplate: true,
    })
  );
  t.falsy(
    tmpl.isFileRelevantToThisTemplate("./test/stubs/default2.txt", {
      isFullTemplate: true,
    })
  );
  t.falsy(
    tmpl.isFileRelevantToThisTemplate("./test/stubs/default.njk", {
      isFullTemplate: true,
    })
  );
});

test("permalink object with build", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-build/permalink-build.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getRawOutputPath(data), "/url/index.html");
  t.is(await tmpl.getOutputHref(data), "/url/");
});

test("permalink object _getLink", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-nobuild/permalink-nobuild.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let link2 = await tmpl._getLink({
    permalink: {
      build: "/build/",
    },
  });
  t.is(await link2.toOutputPath(), "/build/index.html");
  t.is(await link2.toHref(), "/build/");
});

test("permalink object _getLink (array of invalid, previously serverless URLs)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-nobuild/permalink-nobuild.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  // Array of URLs is supported
  let link = await tmpl._getLink({
    test: "a",
    permalink: {
      someotherkey: [],
    },
  });
  t.is(await link.toOutputPath(), false);
  t.is(await link.toHref(), false);
});

test("Permalink is an object but an empty object (inherit default behavior)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-empty-object/empty-object.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let data = await tmpl.getData();

  let outputHref = await tmpl.getOutputHref(data);
  t.is(outputHref, "/permalink-empty-object/empty-object/");

  let outputLink = await tmpl.getRawOutputPath(data);
  t.is(outputLink, "permalink-empty-object/empty-object/index.html");

  let outputPath = await tmpl.getOutputPath(data);
  t.is(outputPath, "./test/stubs/_site/permalink-empty-object/empty-object/index.html");

  let { href, rawPath, path } = await tmpl.getOutputLocations(data);
  t.is(href, "/permalink-empty-object/empty-object/");
  t.is(rawPath, "permalink-empty-object/empty-object/index.html");
  t.is(path, "./test/stubs/_site/permalink-empty-object/empty-object/index.html");
});

test("eleventyComputed returns permalink object Issue #1898", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/stubs-computed-permalink/eleventycomputed-object.11ty.cjs",
    "./test/stubs/stubs-computed-permalink/",
    "./test/stubs/stubs-computed-permalink/_site"
  );

  let data = await tmpl.getData();
  let [page] = await tmpl.getTemplates(data);

  t.is(page.url, "/i18n/en/");
  t.is(page.outputPath, "./test/stubs/stubs-computed-permalink/_site/i18n/en/index.html");
});

test("eleventyComputed returns nested permalink object Issue #1898", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/stubs-computed-permalink/eleventycomputed-nested-object.11ty.cjs",
    "./test/stubs/stubs-computed-permalink/",
    "./test/stubs/stubs-computed-permalink/_site"
  );

  let data = await tmpl.getData();
  let [page] = await tmpl.getTemplates(data);

  t.is(page.url, "/i18n/en/");
  t.is(page.outputPath, "./test/stubs/stubs-computed-permalink/_site/i18n/en/index.html");
});

test("eleventyComputed returns permalink object using permalink string (with replace) Issue #1898", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/stubs-computed-permalink/eleventycomputed-object-replace.11ty.cjs",
    "./test/stubs/stubs-computed-permalink/",
    "./test/stubs/stubs-computed-permalink/_site"
  );

  let data = await tmpl.getData();
  let [page] = await tmpl.getTemplates(data);

  t.is(page.url, "/i18n/en/");
  t.is(page.outputPath, "./test/stubs/stubs-computed-permalink/_site/i18n/en/index.html");
});

test("page.templateSyntax works with templateEngineOverride", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/overrides/page-templatesyntax.md",
    "./test/stubs/",
    "./dist"
  );

  t.is((await renderTemplate(tmpl, await tmpl.getData())).trim(), "<p>njk,md</p>");
});

// Inspired by https://github.com/11ty/eleventy/pull/1691
test("Error messaging, returning literals (not objects) from custom data extension", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs-1691",
    output: "dist"
  }, function(cfg) {
    cfg.addDataExtension("txt", {
      parser: (s) => s,
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs-1691/template.njk",
    "./test/stubs-1691/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(data.str, "Testing");
});
