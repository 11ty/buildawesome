import test from "node:test";

import TemplateMap from "../src/TemplateMap.js";
import TemplateCollection from "../src/TemplateCollection.js";
import UsingCircularTemplateContentReferenceError from "../src/Errors/UsingCircularTemplateContentReferenceError.js";
import { normalizeNewLines } from "./Util/normalizeNewLines.js";

import getNewTemplateForTests from "./_getNewTemplateForTests.js";
import { getRenderedTemplates as getRenderedTmpls, renderTemplate } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

function getNewTemplate(filename, input, output, eleventyConfig) {
  return getNewTemplateForTests(filename, input, output, null, null, eleventyConfig);
}

function getNewTemplateByNumber(num, eleventyConfig) {
  return getNewTemplate(
    `./test/stubs/templateMapCollection/test${num}.md`,
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
}

async function testRenderWithoutLayouts(template, data) {
  let ret = await template.renderPageEntryWithoutLayout({
    rawInput: await template.getPreRender(),
    data,
  });
  return ret;
}

async function addTemplate(collection, template) {
  let data = await template.getData();
  for (let map of await template.getTemplates(data)) {
    collection.add(map);
  }
}

test("TemplateMap has collections added", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await tm.cache();

  t.assert.strictEqual(tm.getMap().length, 2);
  t.assert.strictEqual(tm.collection.getAll().length, 2);
});

test("TemplateMap compared to Collection API", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl4 = await getNewTemplateByNumber(4, eleventyConfig);
  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl4);
  await tm.cache();

  let map = tm.getMap();
  t.assert.deepStrictEqual(map[0].template, tmpl1);
  t.assert.deepStrictEqual(map[0].data.collections.post[0].template, tmpl1);
  t.assert.deepStrictEqual(map[1].template, tmpl4);
  t.assert.deepStrictEqual(map[1].data.collections.post[1].template, tmpl4);

  let c = new TemplateCollection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl4);

  let posts = c.getFilteredByTag("post");
  t.assert.strictEqual(posts.length, 2);
  t.assert.deepStrictEqual(posts[0].template, tmpl1);
  t.assert.deepStrictEqual(posts[1].template, tmpl4);
});

test("populating the collection twice should clear the previous values (--watch was making it cumulative)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  await tm.cache();
  await tm.cache();

  t.assert.strictEqual(tm.getMap().length, 2);
});

test("TemplateMap adds collections data and has templateContent values", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let map = tm.getMap();
  t.assert.ok(!(map[0].data.collections));
  t.assert.ok(!(map[1].data.collections));

  await tm.cache();

  t.assert.ok(map[0]._pages[0].templateContent);
  t.assert.ok(map[1]._pages[0].templateContent);
  t.assert.ok(map[0].data.collections);
  t.assert.ok(map[1].data.collections);
  t.assert.strictEqual(map[0].data.collections.post.length, 1);
  t.assert.strictEqual(map[0].data.collections.all.length, 2);
  t.assert.strictEqual(map[1].data.collections.post.length, 1);
  t.assert.strictEqual(map[1].data.collections.all.length, 2);

  t.assert.strictEqual(
    await testRenderWithoutLayouts(map[0].template, map[0].data),
    map[0]._pages[0].templateContent,
  );
  t.assert.strictEqual(
    await testRenderWithoutLayouts(map[1].template, map[1].data),
    map[1]._pages[0].templateContent,
  );
});

test("TemplateMap circular references (map without templateContent)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl3 = await getNewTemplateByNumber(3, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl3);

  let map = tm.getMap();
  t.assert.ok(!(map[0].data.collections));

  await tm.cache();
  t.assert.ok(map[0]._pages[0].templateContent);
  t.assert.ok(map[0].data.collections);
  t.assert.strictEqual(map[0].data.collections.all.length, 1);

  t.assert.strictEqual(
    await testRenderWithoutLayouts(map[0].template, map[0].data),
    map[0]._pages[0].templateContent,
  );
});

test("TemplateMap circular references (map.templateContent)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tm = new TemplateMap(eleventyConfig);
  let tmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/templateContent.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(tmpl);

  let map = tm.getMap();
  t.assert.ok(!(map[0].data.collections));

  await t.assert.rejects(
    async () => {
      await tm.cache();
    },
    UsingCircularTemplateContentReferenceError,
  );
});

test("Issue #115, mixing pagination and collections", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmplFoos = await getNewTemplate(
    "./test/stubs/issue-115/template-foos.liquid",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  let tmplBars = await getNewTemplate(
    "./test/stubs/issue-115/template-bars.liquid",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  let tmplIndex = await getNewTemplate(
    "./test/stubs/issue-115/index.liquid",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmplFoos);
  await tm.add(tmplBars);
  await tm.add(tmplIndex);
  await tm.cache();

  let map = tm.getMap();
  t.assert.strictEqual(map.length, 3);
  t.assert.deepStrictEqual(map[2].template, tmplIndex);

  let collections = await tm._testGetAllCollectionsData();
  t.assert.strictEqual(Object.keys(collections.all).length, 3);
  t.assert.strictEqual(Object.keys(collections.foos).length, 1);
  t.assert.strictEqual(Object.keys(collections.bars).length, 1);
  t.assert.strictEqual(Object.keys((await tm._testGetCollectionsData()).all).length, 3);
  t.assert.strictEqual(Object.keys((await tm._testGetCollectionsData()).foos).length, 1);
  t.assert.strictEqual(Object.keys((await tm._testGetCollectionsData()).bars).length, 1);

  t.assert.ok(map[0].data.collections);
  t.assert.ok(map[1].data.collections);
  t.assert.ok(map[2].data.collections);
  t.assert.ok(Object.keys(map[2].data.collections).length);

  t.assert.strictEqual(Object.keys(map[0].data.collections.all).length, 3);
  t.assert.strictEqual(Object.keys(map[0].data.collections.foos).length, 1);
  t.assert.strictEqual(Object.keys(map[0].data.collections.bars).length, 1);

  t.assert.strictEqual(Object.keys(map[1].data.collections.all).length, 3);
  t.assert.strictEqual(Object.keys(map[1].data.collections.foos).length, 1);
  t.assert.strictEqual(Object.keys(map[1].data.collections.bars).length, 1);

  t.assert.strictEqual(Object.keys(map[2].data.collections.all).length, 3);
  t.assert.strictEqual(Object.keys(map[2].data.collections.foos).length, 1);
  t.assert.strictEqual(Object.keys(map[2].data.collections.bars).length, 1);

  let entry = await getRenderedTmpls(map[2].template, map[2].data);
  t.assert.deepStrictEqual(
    normalizeNewLines(entry[0].templateContent),
    `This page is foos
This page is bars
`,
  );
});

test("Issue #115 with layout, mixing pagination and collections", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		}
	});

  let tmplFoos = await getNewTemplate(
    "./test/stubs/issue-115/template-foos.liquid",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  let tmplBars = await getNewTemplate(
    "./test/stubs/issue-115/template-bars.liquid",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  let tmplIndex = await getNewTemplate(
    "./test/stubs/issue-115/index-with-layout.liquid",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmplFoos);
  await tm.add(tmplBars);
  await tm.add(tmplIndex);
  await tm.cache();

  let map = tm.getMap();
  t.assert.strictEqual(map.length, 3);
  t.assert.deepStrictEqual(map[2].template, tmplIndex);

  let collections = await tm._testGetAllCollectionsData();
  t.assert.strictEqual(Object.keys(collections.all).length, 3);
  t.assert.strictEqual(Object.keys(collections.foos).length, 1);
  t.assert.strictEqual(Object.keys(collections.bars).length, 1);
  t.assert.strictEqual(Object.keys((await tm._testGetCollectionsData()).all).length, 3);
  t.assert.strictEqual(Object.keys((await tm._testGetCollectionsData()).foos).length, 1);
  t.assert.strictEqual(Object.keys((await tm._testGetCollectionsData()).bars).length, 1);

  t.assert.ok(map[0].data.collections);
  t.assert.ok(map[1].data.collections);
  t.assert.ok(map[2].data.collections);
  t.assert.ok(Object.keys(map[2].data.collections).length);

  t.assert.strictEqual(Object.keys(map[0].data.collections.all).length, 3);
  t.assert.strictEqual(Object.keys(map[0].data.collections.foos).length, 1);
  t.assert.strictEqual(Object.keys(map[0].data.collections.bars).length, 1);

  t.assert.strictEqual(Object.keys(map[1].data.collections.all).length, 3);
  t.assert.strictEqual(Object.keys(map[1].data.collections.foos).length, 1);
  t.assert.strictEqual(Object.keys(map[1].data.collections.bars).length, 1);

  t.assert.strictEqual(Object.keys(map[2].data.collections.all).length, 3);
  t.assert.strictEqual(Object.keys(map[2].data.collections.foos).length, 1);
  t.assert.strictEqual(Object.keys(map[2].data.collections.bars).length, 1);

  let entry = await getRenderedTmpls(map[2].template, map[2].data);
  t.assert.deepStrictEqual(
    normalizeNewLines(entry[0].templateContent),
    `This page is foos
This page is bars
`,
  );
});

test("TemplateMap adds collections data and has page data values using .cache()", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		}
	});

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let map = tm.getMap();
  await tm.cache();
  t.assert.strictEqual(map[0].data.page.url, "/templateMapCollection/test1/");
  t.assert.strictEqual(map[0].data.page.outputPath, "./test/stubs/_site/templateMapCollection/test1/index.html");
  t.assert.strictEqual(map[0].data.page.inputPath, "./test/stubs/templateMapCollection/test1.md");
  t.assert.strictEqual(map[0].data.page.fileSlug, "test1");
  t.assert.ok(map[0].data.page.date);
});

test("TemplateMap adds collections data and has page data values using ._testGetCollectionsData()", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		}
	});

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all[0].url, "/templateMapCollection/test1/");
  t.assert.strictEqual(collections.all[0].outputPath, "./test/stubs/_site/templateMapCollection/test1/index.html");

  t.assert.strictEqual(collections.all[0].data.page.url, "/templateMapCollection/test1/");
  t.assert.strictEqual(
    collections.all[0].data.page.outputPath,
    "./test/stubs/_site/templateMapCollection/test1/index.html",
  );
  t.assert.strictEqual(collections.all[0].data.page.inputPath, "./test/stubs/templateMapCollection/test1.md");
  t.assert.strictEqual(collections.all[0].data.page.fileSlug, "test1");
});

test("Url should be available in user config collections API calls", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        return collection.getAll();
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  t.assert.ok(collections.userCollection);
  t.assert.ok(collections.userCollection.length);
  t.assert.strictEqual(collections.userCollection[0].url, "/templateMapCollection/test1/");
  t.assert.strictEqual(
    collections.userCollection[0].outputPath,
    "./test/stubs/_site/templateMapCollection/test1/index.html",
  );

  t.assert.strictEqual(collections.userCollection[0].data.page.url, "/templateMapCollection/test1/");
  t.assert.strictEqual(
    collections.userCollection[0].data.page.outputPath,
    "./test/stubs/_site/templateMapCollection/test1/index.html",
  );
});

test("Url should be available in user config collections API calls (test in callback)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        let all = collection.getAll();
        t.assert.strictEqual(all[0].url, "/templateMapCollection/test1/");
        t.assert.strictEqual(all[0].outputPath, "./test/stubs/_site/templateMapCollection/test1/index.html");
        t.assert.strictEqual(all[1].url, "/templateMapCollection/test2/");
        t.assert.strictEqual(all[1].outputPath, "./test/stubs/_site/templateMapCollection/test2/index.html");

        return all;
      });
    }
  );

  let tm = new TemplateMap(eleventyConfig);
  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await tm.cache();
});

test("Should be able to paginate a tag generated collection", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/paged-tag.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();
  t.assert.ok(collections.dog);
  t.assert.ok(collections.dog.length);
});

test("Should be able to paginate a user config collection", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        let all = collection.getFilteredByTag("dog");
        return all;
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();
  t.assert.ok(collections.userCollection);
  t.assert.ok(collections.userCollection.length);
});

test("Should be able to paginate a user config collection (uses rendered permalink)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        let all = collection.getFilteredByTag("dog");
        t.assert.strictEqual(all[0].url, "/templateMapCollection/test1/");
        t.assert.strictEqual(all[0].outputPath, "./test/stubs/_site/templateMapCollection/test1/index.html");
        return all;
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-permalink.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();
  t.assert.ok(collections.userCollection);
  t.assert.ok(collections.userCollection.length);

  let urls = [];
  for (let item of collections.all) {
    urls.push(item.url);
  }
  t.assert.strictEqual(urls.indexOf("/test-title/hello/") > -1, true);
});

test("Should be able to paginate a user config collection (paged template is also tagged)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        let all = collection.getFilteredByTag("dog");
        return all;
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);
  let tmpl4 = await getNewTemplateByNumber(4, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-tagged.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.dog.length, 2);

  t.assert.ok(collections.haha);
  t.assert.strictEqual(collections.haha.length, 1);
  t.assert.strictEqual(collections.haha[0].url, "/templateMapCollection/paged-cfg-tagged/");
});

test("Should be able to paginate a user config collection (paged template is also tagged, add all pages to collections)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        let all = collection.getFilteredByTag("dog");
        return all;
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);
  let tmpl4 = await getNewTemplateByNumber(4, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-tagged-apply-to-all.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.dog.length, 2);

  t.assert.ok(collections.haha);
  t.assert.strictEqual(collections.haha.length, 2);
  t.assert.strictEqual(collections.haha[0].url, "/templateMapCollection/paged-cfg-tagged-apply-to-all/");
  t.assert.strictEqual(collections.haha[1].url, "/templateMapCollection/paged-cfg-tagged-apply-to-all/1/");
});

test("Should be able to paginate a user config collection (paged template is also tagged, uses custom rendered permalink)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        let all = collection.getFilteredByTag("dog");
        return all;
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);
  let tmpl4 = await getNewTemplateByNumber(4, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-tagged-permalink.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();
  t.assert.ok(collections.haha);
  t.assert.strictEqual(collections.haha.length, 1);
  t.assert.strictEqual(collections.haha[0].url, "/test-title/goodbye/");
});

test("Should be able to paginate a user config collection (paged template is also tagged, uses custom rendered permalink, add all pages to collections)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        let all = collection.getFilteredByTag("dog");
        return all;
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);
  let tmpl4 = await getNewTemplateByNumber(4, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-tagged-permalink-apply-to-all.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();
  t.assert.ok(collections.haha);
  t.assert.strictEqual(collections.haha.length, 2);
  t.assert.strictEqual(collections.haha[0].url, "/test-title/goodbye/");
  t.assert.strictEqual(collections.haha[1].url, "/test-title-4/goodbye/");
});

test("TemplateMap render and templateContent are the same (templateContent doesn’t have layout but makes proper use of layout front matter data)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		}
	});

  let tm = new TemplateMap(eleventyConfig);
  let tmplLayout = await getNewTemplate(
    "./test/stubs/templateMapCollection/testWithLayout.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  await tm.add(tmplLayout);

  let map = tm.getMap();
  await tm.cache();
  t.assert.strictEqual(map[0]._pages[0].templateContent.trim(), "<p>Inherited</p>");
  t.assert.strictEqual((await renderTemplate(map[0].template, map[0].data)).trim(), "<p>Inherited</p>");
});

test("Should be able to paginate a tag generated collection (and it has templateContent)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);
  let tmpl4 = await getNewTemplateByNumber(4, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/paged-tag-dogs-templateContent.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  await tm.cache();

  let pagedMapEntry = tm.getMapEntryForInputPath(
    "./test/stubs/templateMapCollection/paged-tag-dogs-templateContent.md",
  );

  let templates = await getRenderedTmpls(pagedMapEntry.template, pagedMapEntry.data);
  t.assert.strictEqual(templates.length, 2);
  t.assert.strictEqual(templates[0].data.pagination.pageNumber, 0);
  t.assert.strictEqual(templates[1].data.pagination.pageNumber, 1);

  t.assert.strictEqual(
    templates[0].templateContent.trim(),
    `<p>Before</p>
<h1>Test 1</h1>
<p>After</p>`,
  );
  t.assert.strictEqual(
    templates[1].templateContent.trim(),
    `<p>Before</p>
<h1>Test 4</h1>
<p>After</p>`,
  );
});

test("Should be able to paginate a tag generated collection when aliased (and it has templateContent)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);
  let tmpl4 = await getNewTemplateByNumber(4, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/templateMapCollection/paged-tag-dogs-templateContent-alias.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  await tm.cache();

  let pagedMapEntry = tm.getMapEntryForInputPath(
    "./test/stubs/templateMapCollection/paged-tag-dogs-templateContent-alias.md",
  );

  let templates = await getRenderedTmpls(pagedMapEntry.template, pagedMapEntry.data);
  t.assert.strictEqual(templates.length, 1);
  t.assert.strictEqual(templates[0].data.pagination.pageNumber, 0);
  t.assert.strictEqual(
    templates[0].templateContent.trim(),
    `<p>Before</p>
<h1>Test 1</h1>
<h1>Test 4</h1>
<p>After</p>`,
  );
});

test("Issue #253: Paginated template with a tag should put multiple pages into a collection", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        // TODO test user config collections (no actual tests against this collection yet)
        let all = collection.getFilteredByTag("dog");
        return all;
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);
  let tmpl4 = await getNewTemplateByNumber(4, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await tm.add(tmpl4);

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/tagged-pagination-multiples/test.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.dog.length, 2);

  t.assert.ok(collections.haha);
  t.assert.strictEqual(collections.haha.length, 2);
  t.assert.strictEqual(collections.haha[0].url, "/tagged-pagination-multiples/test/");
  t.assert.strictEqual(collections.haha[1].url, "/tagged-pagination-multiples/test/1/");
});

test("getUserConfigCollectionNames", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        return collection.getAll();
      });
      cfg.addCollection("otherUserCollection", function (collection) {
        return collection.getAll();
      });
    }
  );

  let tm = new TemplateMap(eleventyConfig);
  t.assert.deepStrictEqual(tm.getUserConfigCollectionNames(), ["userCollection", "otherUserCollection"]);
});

test("isUserConfigCollectionName", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        return collection.getAll();
      });
    }
  );

  let tm = new TemplateMap(eleventyConfig);

  t.assert.strictEqual(tm.isUserConfigCollectionName("userCollection"), true);
  t.assert.strictEqual(tm.isUserConfigCollectionName("userCollection2"), false);
});

test("Dependency Map should have nodes that have no dependencies and no dependents", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl5 = await getNewTemplateByNumber(5, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl5);

  await tm.cache();

  let deps = tm.getTemplateOrder();
  t.assert.strictEqual(deps.filter((dep) => dep.indexOf("test5.md") > -1).length > 0, true);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 2);
});

test("Dependency Map should have include orphan user config collections (in the correct order) #3711", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        return collection.getAll();
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl5 = await getNewTemplateByNumber(5, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl5);

  await tm.cache();

  let deps = tm.getTemplateOrder();
  t.assert.deepStrictEqual(deps,  [
    './test/stubs/templateMapCollection/test1.md',
    '__collection:post',
    '__collection:dog',
    './test/stubs/templateMapCollection/test5.md',
    '__collection:userCollection',
    '__collection:[keys]',
    '__collection:all'
  ]);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 2);
  t.assert.strictEqual(collections.userCollection.length, 2);
});

test("Dependency Map should have include orphan user config collections, mapped by user collection api to tag #3711", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addCollection("userCollection", function (collection) {
        return collection.getFilteredByTag("post");
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl5 = await getNewTemplateByNumber(5, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl5);

  await tm.cache();

  let deps = tm.getTemplateOrder();
  t.assert.deepStrictEqual(deps,  [
    './test/stubs/templateMapCollection/test1.md',
    '__collection:post',
    '__collection:dog',
    './test/stubs/templateMapCollection/test5.md',
    '__collection:userCollection',
    '__collection:[keys]',
    '__collection:all',
  ]);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 2);
  t.assert.strictEqual(collections.userCollection.length, 1);
});

test("Template pages should not have layouts when added to collections", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		}
	});

  let tm = new TemplateMap(eleventyConfig);
  let tmpl = await getNewTemplate(
    "./test/stubs/collection-layout-wrap.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(tmpl);
  t.assert.strictEqual(await renderTemplate(tmpl, await tmpl.getData()), "<div>Layout Test</div>");

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 1);
  t.assert.strictEqual(collections.all[0].templateContent, "Layout Test");
});

test("Paginated template pages should not have layouts when added to collections", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: "test/stubs",
			output: "test/stubs/_site",
		}
	});

  let tm = new TemplateMap(eleventyConfig);

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/tagged-pagination-multiples-layout/test.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();

  t.assert.strictEqual(collections.all.length, 3);
  t.assert.strictEqual(collections.all[0].templateContent, "one");
  t.assert.strictEqual(collections.all[1].templateContent, "two");
  t.assert.strictEqual(collections.all[2].templateContent, "three");
});

test("Tag pages. Allow pagination over all collections a la `data: collections`", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/page-target-collections/tagpages.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  await tm.add(pagedTmpl);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 3);

  let collectionTagPagesTemplateContents = new Set(
    collections.all
      .filter(function (entry) {
        return entry.inputPath.endsWith("tagpages.njk");
      })
      .map(function (entry) {
        return entry.templateContent.trim();
      }),
  );
  t.assert.deepStrictEqual(collectionTagPagesTemplateContents, new Set(["post"]));
});

test("Tag pages (all pages added to collections). Allow pagination over all collections a la `data: collections`", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/page-target-collections/tagpagesall.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  await tm.add(pagedTmpl);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 5);

  let collectionTagPagesTemplateContents = new Set(
    collections.all
      .filter(function (entry) {
        return entry.inputPath.endsWith("tagpagesall.njk");
      })
      .map(function (entry) {
        return entry.templateContent.trim();
      }),
  );
  t.assert.deepStrictEqual(collectionTagPagesTemplateContents, new Set(["post", "dog", "cat"]));
});

test("eleventyExcludeFromCollections", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);

  let excludedTmpl = await getNewTemplate(
    "./test/stubs/eleventyExcludeFromCollections.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  await tm.add(excludedTmpl);

  await tm.cache();

  t.assert.strictEqual(tm.getMap().length, 2);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 1);
  t.assert.strictEqual(collections.post.length, 1);
  t.assert.strictEqual(collections.dog.length, 1);
});

test("eleventyExcludeFromCollections and permalink: false", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);

  let excludedTmpl = await getNewTemplate(
    "./test/stubs/eleventyExcludeFromCollectionsPermalinkFalse.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  await tm.add(excludedTmpl);

  await tm.cache();

  t.assert.strictEqual(tm.getMap().length, 2);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 1);
  t.assert.strictEqual(collections.post.length, 1);
  t.assert.strictEqual(collections.dog.length, 1);
});

test("Paginate over collections.all", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/page-target-collections/paginateall.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  await tm.add(pagedTmpl);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 4);
  t.assert.strictEqual(
    collections.all.filter(function (entry) {
      return entry.inputPath.endsWith("test1.md");
    }).length,
    1,
  );
  t.assert.strictEqual(
    collections.all.filter(function (entry) {
      return entry.inputPath.endsWith("test2.md");
    }).length,
    1,
  );
  t.assert.strictEqual(
    collections.all.filter(function (entry) {
      return entry.inputPath.endsWith("paginateall.njk");
    }).length,
    2,
  );

  let map = tm.getMap();
  t.assert.strictEqual(map[0].inputPath, "./test/stubs/page-target-collections/paginateall.njk");
  t.assert.strictEqual(map[0]._pages.length, 2);
  t.assert.strictEqual(map[0]._pages[0].templateContent, "INPUT PATH:./test/stubs/templateMapCollection/test1.md");
  t.assert.strictEqual(map[0]._pages[1].templateContent, "INPUT PATH:./test/stubs/templateMapCollection/test2.md");
  t.assert.strictEqual(map[1].inputPath, "./test/stubs/templateMapCollection/test1.md");
  t.assert.strictEqual(map[1]._pages[0].templateContent.trim(), "<h1>Test 1</h1>");
  t.assert.strictEqual(map[2].inputPath, "./test/stubs/templateMapCollection/test2.md");
  t.assert.strictEqual(map[2]._pages[0].templateContent.trim(), "<h1>Test 2</h1>");
});

test("Paginate over collections (tag pages) related to #3823", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);

  let tagPagesTmpl = await getNewTemplate(
    "./test/stubs/page-target-collections/tagpagesall.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  await tm.add(tagPagesTmpl);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  // 2 individual templates, 3 pages for tagpagesall
  t.assert.deepStrictEqual(collections.all.map(entry => entry.url).sort(), [
    '/test/stubs/page-target-collections/tagpagesall/',
    '/test/stubs/page-target-collections/tagpagesall/1/',
    '/test/stubs/page-target-collections/tagpagesall/2/',
    '/test/stubs/templateMapCollection/test1/',
    '/test/stubs/templateMapCollection/test2/',
  ]);
});

test("Paginate over collections.all WITH a paginate over collections (tag pages) related to #3823", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);
  let tmpl2 = await getNewTemplateByNumber(2, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);

  let pagedTmpl = await getNewTemplate(
    "./test/stubs/page-target-collections/paginateall.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  let tagPagesTmpl = await getNewTemplate(
    "./test/stubs/page-target-collections/tagpagesall.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  await tm.add(pagedTmpl);
  await tm.add(tagPagesTmpl);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  // 2 individual templates, 3 pages for tagpagesall, 5 pages from paginateall to paginate the 2+3
  t.assert.strictEqual(collections.all.length, 10);
});

test("Test a transform with a layout (via templateMap)", async (t) => {
  t.plan(7);
  let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: "./test/stubs-475/",
			output: "./test/stubs-475/_site",
		}
	});

  let tm = new TemplateMap(eleventyConfig);
  let tmpl = await getNewTemplate(
    "./test/stubs-475/transform-layout/transform-layout.njk",
    "./test/stubs-475/",
    "./test/stubs-475/_site",
    eleventyConfig,
  );

  tmpl.addLinter(function (content, inputPath, outputPath) {
    // should be pre-transform content
    t.assert.strictEqual(content, "<html><body>This is content.</body></html>");
    t.assert.strictEqual(inputPath.endsWith("transform-layout.njk"), true);
    t.assert.strictEqual(outputPath.endsWith("transform-layout/index.html"), true);
  });

  tmpl.setTransforms({
    transformName: function (content, outputPath) {
      t.assert.strictEqual(content, "<html><body>This is content.</body></html>");
      t.assert.strictEqual(outputPath.endsWith("transform-layout/index.html"), true);
      return "OVERRIDE BY A TRANSFORM";
    }
  });

  await tm.add(tmpl);

  await tm.cache();
  t.assert.strictEqual(tm.getMap().length, 1);

  for (let entry of tm.getMap()) {
    for (let page of entry._pages) {
      t.assert.strictEqual(await page.template.renderPageEntry(page), "OVERRIDE BY A TRANSFORM");
    }
  }
});

test("Async user collection addCollection method", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs/",
    	output: "./test/stubs/_site",
		},
    function(cfg) {
      cfg.addCollection("userCollection", async function (collection) {
        return new Promise((resolve) => {
          setTimeout(function () {
            resolve(collection.getAll());
          }, 50);
        });
      });
    }
  );

  let tmpl1 = await getNewTemplateByNumber(1, eleventyConfig);

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.userCollection[0].url, "/templateMapCollection/test1/");

  t.assert.strictEqual(collections.userCollection[0].data.collections.userCollection.length, 1);
});

test("Duplicate permalinks in template map", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplate(
    "./test/stubs/permalink-conflicts/test1.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  let tmpl2 = await getNewTemplate(
    "./test/stubs/permalink-conflicts/test2.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await t.assert.rejects(async () => {
    await tm.cache();
  });
});

test("No duplicate permalinks in template map, using false", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplate(
    "./test/stubs/permalink-conflicts-false/test1.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  let tmpl2 = await getNewTemplate(
    "./test/stubs/permalink-conflicts-false/test2.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await tm.cache();
  t.assert.strictEqual(true, true);
});

test("Duplicate permalinks in template map, no leading slash", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplate(
    "./test/stubs/permalink-conflicts/test1.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  let tmpl3 = await getNewTemplate(
    "./test/stubs/permalink-conflicts/test3.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  let tm = new TemplateMap(eleventyConfig);
  await tm.add(tmpl1);
  await tm.add(tmpl3);

  await t.assert.rejects(async () => {
    await tm.cache();
  });
});

test("TemplateMap circular references (map.templateContent) using eleventyExcludeFromCollections and collections.all", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tm = new TemplateMap(eleventyConfig);
  let tmplExcluded = await getNewTemplate(
    "./test/stubs/issue-522/excluded.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );
  await tm.add(tmplExcluded);

  let tmpl = await getNewTemplate(
    "./test/stubs/issue-522/template.md",
    "./test/stubs/",
    "./test/stubs/_site",
    eleventyConfig,
  );

  await tm.add(tmpl);

  let map = tm.getMap();
  t.assert.ok(!(map[0].data.collections));

  await tm.cache();

  let deps = tm.getTemplateOrder();
  t.assert.deepStrictEqual(deps, [
    "./test/stubs/issue-522/excluded.md",
    "./test/stubs/issue-522/template.md",
    "__collection:[keys]",
    "__collection:all",
  ]);

  t.assert.strictEqual(tm.getMap().length, 2);

  let collections = await tm._testGetCollectionsData();
  t.assert.strictEqual(collections.all.length, 1);
});

test("eleventy.layouts Event", async (t) => {
  t.plan(1);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
			input: "./test/stubs-layouts-event/",
			output: "./test/stubs-layouts-event/_site",
		},
    function(cfg) {
      cfg.on("buildawesome.layouts", (layoutMap) => {
        t.assert.deepStrictEqual(layoutMap, {
          "./test/stubs-layouts-event/_includes/first.liquid": ["./test/stubs-layouts-event/page.md"],
          "./test/stubs-layouts-event/_includes/second.liquid": [
            "./test/stubs-layouts-event/page.md",
            "./test/stubs-layouts-event/_includes/first.liquid",
          ],
          "./test/stubs-layouts-event/_includes/third.liquid": [
            "./test/stubs-layouts-event/page.md",
            "./test/stubs-layouts-event/_includes/first.liquid",
            "./test/stubs-layouts-event/_includes/second.liquid",
          ],
        });
      });
    }
  );

  let tm = new TemplateMap(eleventyConfig);
  let tmpl = await getNewTemplate(
    "./test/stubs-layouts-event/page.md",
    "./test/stubs-layouts-event/",
    "./test/stubs-layouts-event/_site",
    eleventyConfig,
  );

  await tm.add(tmpl);
  await tm.cache();
});
