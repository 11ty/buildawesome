import test from "ava";
import fs from "fs";

import TemplateData from "../src/Data/TemplateData.js";
import getNewTemplate from "./_getNewTemplateForTests.js";

import { getTemplateConfigInstance } from "./_testHelpers.js";

async function writeMapEntry(entry) {
  let promises = [];
  if (entry.template.behavior.isWriteable()) {
    promises.push(entry.template._write(entry.outputPath, entry.templateContent));
  }
  return Promise.all(promises);
}

async function getTemplateMapEntryWithContent(template, data) {
  let entry = await template.getTemplateMapEntry(data);

  entry._pages = await entry.template.getTemplates(entry.data);
  await Promise.all(
    entry._pages.map(async (page) => {
      page.templateContent = await page.template.renderPageEntryWithoutLayout(page);
      return page;
    })
  );

  return entry;
}

test("permalink: false", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-false/test.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();

  let entry = await getTemplateMapEntryWithContent(tmpl, data);
  t.is(entry.template.behavior.isWriteable(), false);
  t.is(entry.data.page.url, false);
  t.is(entry.data.page.outputPath, false);

  await writeMapEntry(entry);

  // Input file exists (sanity check for paths)
  t.is(fs.existsSync("./test/stubs/permalink-false/"), true);
  t.is(fs.existsSync("./test/stubs/permalink-false/test.md"), true);

  // Output does not exist
  t.is(fs.existsSync("./test/stubs/_site/permalink-false/"), false);
  t.is(fs.existsSync("./test/stubs/_site/permalink-false/test/"), false);
  t.is(fs.existsSync("./test/stubs/_site/permalink-false/test/index.html"), false);
});

test("permalink: false inside of eleventyComputed, Issue #1754", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-false-computed/test.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let entry = await getTemplateMapEntryWithContent(tmpl, data);
  t.is(entry.template.behavior.isWriteable(), false);
  t.is(entry.data.page.url, false);
  t.is(entry.data.page.outputPath, false);

  await writeMapEntry(entry);

  // Input file exists (sanity check for paths)
  t.is(fs.existsSync("./test/stubs/permalink-false-computed/"), true);
  t.is(fs.existsSync("./test/stubs/permalink-false-computed/test.md"), true);

  // Output does not exist
  t.is(fs.existsSync("./test/stubs/_site/permalink-false-computed/"), false);
  t.is(fs.existsSync("./test/stubs/_site/permalink-false-computed/test/"), false);
  t.is(fs.existsSync("./test/stubs/_site/permalink-false-computed/test/index.html"), false);
});

test("permalink: true", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalink-true/permalink-true.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  await t.throwsAsync(async () => {
    await tmpl.getRawOutputPath(data);
  });
});

test("Disable dynamic permalinks", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/dynamic-permalink/test.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let data = await tmpl.getData();

  t.is(await tmpl.getRawOutputPath(data), "/{{justastring}}/index.html");
  t.is(await tmpl.getOutputHref(data), "/{{justastring}}/");
  // TODO https://github.com/11ty/eleventy-plugin-webc/issues/32
  // t.is(data.page.url, "/{{justastring}}/")
});

test("Permalink with variables!", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/permalinkdata.njk", "./test/stubs/", "./dist");

  let data = await tmpl.getData();

  t.is(await tmpl.getOutputPath(data), "./dist/subdir/slug-candidate/index.html");
});

test("Permalink with variables and JS front matter!", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/permalinkdata-jsfn.njk", "./test/stubs/", "./dist");
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/subdir/slug/index.html");
});

test("Use a JavaScript function for permalink in any template language", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/permalinkdata-jspermalinkfn.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/subdir/slug/index.html");
});

test("Permalink with dates!", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/permalinkdate.liquid", "./test/stubs/", "./dist");
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/2016/01/01/index.html");
});

test.skip("Permalink with dates on file name regex!", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/2016-02-01-permalinkdate.liquid",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/2016/02/01/index.html");
});

test("Reuse permalink in directory specific data file", async (t) => {
	let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: "test/stubs",
			output: "dist"
		}
	});

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/reuse-permalink/test1.liquid",
    "./test/stubs/",
    "./dist",
    dataObj
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/2016/01/01/index.html");
});

test("Using slugify filter!", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/slugify-filter/test.njk",
    "./test/slugify-filter/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/subdir/slug-love-candidate-lyublyu/index.html");
});

test("Using slugify filter with comma and apostrophe", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/slugify-filter/comma.njk",
    "./test/slugify-filter/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/subdir/hi-i-m-zach/index.html");
});

test("Using slug filter with options params", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/slugify-filter/slug-options.njk",
    "./test/slugify-filter/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/subdir/hi_i_am_zach/index.html");
});

test("Using slugify filter with options params", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/slugify-filter/slugify-options.njk",
    "./test/slugify-filter/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/subdir/hi-i-m-z-ach/index.html");
});

test("Using slugify filter with a number #854", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/slugify-filter/slugify-number.njk",
    "./test/slugify-filter/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/subdir/1/index.html");
});

test("Using slug filter with a number #854", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/slugify-filter/slug-number.njk",
    "./test/slugify-filter/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/subdir/1/index.html");
});

test.skip("Using slugify filter with multibyte", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/slugify-filter/multibyte.njk",
    "./test/slugify-filter/",
    "./dist"
  );
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./dist/subdir/test-猫/index.html");
});
