import test from "node:test";

import Eleventy from "../src/Core.js";
import TemplateData from "../src/Data/TemplateData.js";
import ExtensionMap from "../src/ExtensionMap.js";

import getNewTemplate from "./_getNewTemplateForTests.js";
import { renderTemplate } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback, sortEleventyResults } from "./_testHelpers.js";

async function getRenderedData(tmpl, pageNumber = 0) {
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  return templates[pageNumber].data;
}

test("eleventyComputed", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/first.njk",
    "./test/stubs/",
    "./dist"
  );
  let data = await getRenderedData(tmpl);
  t.assert.strictEqual((await renderTemplate(tmpl, data)).trim(), "hi:value2-value1.css");
});

test("eleventyComputed overrides existing value.", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/override.njk",
    "./test/stubs/",
    "./dist"
  );
  let data = await getRenderedData(tmpl);
  t.assert.strictEqual(data.key1, "override");
  t.assert.strictEqual((await renderTemplate(tmpl, data)).trim(), "hi:override");
});

test("eleventyComputed overrides existing value and reuses that upstream value", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/override-reuse.njk",
    "./test/stubs/",
    "./dist"
  );
  let data = await getRenderedData(tmpl);
  t.assert.strictEqual(data.key1, "over(value1)ride");
  t.assert.strictEqual((await renderTemplate(tmpl, data)).trim(), "hi:over(value1)ride");
});

test("eleventyComputed permalink", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/permalink.njk",
    "./test/stubs/",
    "./dist"
  );
  let templates = await tmpl.getTemplates(await tmpl.getData());
  let data = templates[0].data;
  t.assert.strictEqual(data.page.url, "/haha-value1.html");
  t.assert.strictEqual(data.page.outputPath, "./dist/haha-value1.html");
  t.assert.strictEqual(data.permalink, "haha-value1.html");
  t.assert.strictEqual(data.nested.key3, "value1");
  t.assert.strictEqual(data.nested.key4, "depends on computed value1");
  t.assert.strictEqual(data.dependsOnPage, "depends:/haha-value1.html");
});

test("eleventyComputed simple permalink", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/permalink-simple.njk",
    "./test/stubs/",
    "./dist"
  );
  let templates = await tmpl.getTemplates(await tmpl.getData());
  let data = templates[0].data;
  t.assert.strictEqual(data.page.url, "/haha-value1.html");
  t.assert.strictEqual(data.page.outputPath, "./dist/haha-value1.html");
  t.assert.strictEqual(data.permalink, "haha-value1.html");
});

test("eleventyComputed permalink using slug", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/permalink-slug.njk",
    "./test/stubs/",
    "./dist"
  );
  let templates = await tmpl.getTemplates(await tmpl.getData());
  let data = templates[0].data;
  t.assert.strictEqual(data.page.url, "/haha-this-is-a-string.html");
  t.assert.strictEqual(data.page.outputPath, "./dist/haha-this-is-a-string.html");
  t.assert.strictEqual(data.permalink, "haha-this-is-a-string.html");
});

test("eleventyComputed js front matter (function)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/second.njk",
    "./test/stubs/",
    "./dist"
  );
  let data = await getRenderedData(tmpl);
  t.assert.strictEqual(data.key3, "value3-value2-value1.css");
  t.assert.strictEqual((await renderTemplate(tmpl, data)).trim(), "hi:value2-value1.css");
});

test("eleventyComputed js front matter key reuses and overrides", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/third.njk",
    "./test/stubs/",
    "./dist"
  );
  let data = await getRenderedData(tmpl);
  t.assert.strictEqual(data.key1, "value2-value1");
  t.assert.strictEqual((await renderTemplate(tmpl, data)).trim(), "hi:value2-value1");
});

test("eleventyComputed true primitive", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/true.njk",
    "./test/stubs/",
    "./dist"
  );
  let data = await getRenderedData(tmpl);
  t.assert.strictEqual(data.key1, "value1");
  t.assert.strictEqual(data.key2, true);
  t.assert.strictEqual(data.key3, false);
  t.assert.strictEqual(data.key4, 324);
});

test("eleventyComputed relies on global data", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist",
    }
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/eleventyComputed/use-global-data.njk",
    "./test/stubs/",
    "./dist",
    dataObj,
    null,
    eleventyConfig
  );

  let fetchedData = await tmpl.getData();
  let templates = await tmpl.getTemplates(fetchedData);
  let data = templates[0].data;
  t.assert.strictEqual(data.image, "datavalue1");
});

test("eleventyComputed intermixes with global data", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs-computed-global",
    output: "dist",
  }, function(cfg) {
    // Defaulted in v1
    // cfg.setDataDeepMerge(true);
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs-computed-global/intermix.njk",
    "./test/stubs-computed-global/",
    "./dist",
    dataObj,
    null,
    eleventyConfig
  );

  let fetchedData = await tmpl.getData();
  t.assert.ok(fetchedData.buildawesomeComputed.image);
  t.assert.ok(fetchedData.buildawesomeComputed.image2);
  t.assert.ok(fetchedData.buildawesomeComputed.image3);
  t.assert.ok(fetchedData.buildawesomeComputed.eleventyNavigation.key);

  let templates = await tmpl.getTemplates(fetchedData);
  let data = templates[0].data;
  t.assert.strictEqual(data.image, "first");
  t.assert.strictEqual(data.image2, "second");
  t.assert.strictEqual(data.image3, "third-global");
  t.assert.strictEqual(data.eleventyNavigation.key, "nested-first-global");
});

test("eleventyComputed using symbol parsing on template strings (nunjucks)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs-computed-symbolparse",
    output: "dist",
  }, function(cfg) {
    cfg.addNunjucksFilter("fail", function (str) {
      // Filter expects a certain String format, don’t use the (((11ty))) string hack
      if (!str || str.length !== 1) {
        throw new Error("Expect a one character string");
      }
      return `${str}`;
    });
  });

  let tmpl = await getNewTemplate(
    "./test/stubs-computed-symbolparse/test.njk",
    "./test/stubs-computed-symbolparse/",
    "./test/stubs-computed-symbolparse/_site",
    null,
    null,
    eleventyConfig
  );

  let data = await getRenderedData(tmpl);
  t.assert.strictEqual(data.a, "a");
  t.assert.strictEqual(data.b, "b");
  t.assert.strictEqual(data.c, "ab");
});

test("eleventyComputed using symbol parsing on template strings (liquid)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs-computed-symbolparse",
    output: "dist",
  }, function(cfg) {
    cfg.addLiquidFilter("fail", function (str) {
      // Filter expects a certain String format, don’t use the (((11ty))) string hack
      if (!str || str.length !== 1) {
        throw new Error("Expect a one character string: " + str);
      }
      return `${str}`;
    });
  });

  let tmpl = await getNewTemplate(
    "./test/stubs-computed-symbolparse/test.liquid",
    "./test/stubs-computed-symbolparse/",
    "./test/stubs-computed-symbolparse/_site",
    null,
    null,
    eleventyConfig
  );

  let data = await getRenderedData(tmpl);
  t.assert.strictEqual(data.a, "a");
  t.assert.strictEqual(data.b, "b");
  t.assert.strictEqual(data.c, "ab");
});

test("eleventyComputed render strings in arrays", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs-computed-array/test.liquid",
    "./test/stubs-computed-array/",
    "./test/stubs-computed-array/_site"
  );

  let data = await getRenderedData(tmpl);
  t.assert.deepStrictEqual(data.array, ["static value", "test"]);
  t.assert.strictEqual(data.notArray, "test");
});

test("Issue #3728 Computed data with arrays of different sizes, arrays are treated as a single unit", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addTemplate("index.njk", `---js
const arr = [1,2,3,4,5];
const eleventyComputed = {
  arr: ["a", "b", "c"]
}
---
{{ arr }}`);
    }
  });
  elev.disableLogger();

  let result = await elev.toJSON();
  t.assert.strictEqual(result.length, 1);
  t.assert.strictEqual(result[0].content, `a,b,c`);
});

test("Issue #3827 with Computed data with arrays and layouts (×2 eleventyComputed)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.setUseTemplateCache(false);
      $config.addTemplate("_includes/base.njk", `---js
const eleventyComputed = {
  arr: ["base", "base2"]
};
---
{{ content | safe }}`);

      $config.addTemplate("page1.njk", `---js
const layout = "base.njk";
---
{{ arr }}`);

    $config.addTemplate("page2.njk", `---js
const layout = "base.njk";
const eleventyComputed = {
  arr: ["override", "override2"]
}
---
{{ arr }}`);
    }
  });

  elev.disableLogger();

  let result = await elev.toJSON();
  result.sort(sortEleventyResults);

  t.assert.strictEqual(result.length, 2);

  t.assert.strictEqual(result[0].inputPath, `./test/stubs-virtual/page2.njk`);
  // A merge happened here because it was eleventyComputed -> eleventyComputed array merge before computed data
  t.assert.strictEqual(result[0].content, `base,base2,override,override2`);

  t.assert.strictEqual(result[1].inputPath, `./test/stubs-virtual/page1.njk`);
  t.assert.strictEqual(result[1].content, `base,base2`);
});

test("Issue #3728 with Computed data with arrays and layouts (×1 eleventyComputed)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addTemplate("_includes/base.njk", `---js
const arr = ["base", 1];
---
{{ content | safe }}`);

      $config.addTemplate("page1.njk", `---js
const layout = "base.njk";
---
{{ arr }}`);

    $config.addTemplate("page2.njk", `---js
const layout = "base.njk";
const eleventyComputed = {
  arr: ["override", 2]
}
---
{{ arr }}`);
    }
  });

  elev.disableLogger();

  let result = await elev.toJSON();
  result.sort(sortEleventyResults);

  t.assert.strictEqual(result.length, 2);

  t.assert.strictEqual(result[0].content, `override,2`);
  t.assert.strictEqual(result[1].content, `base,1`);
});
