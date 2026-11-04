import test from "node:test";

import Eleventy from "../src/Core.js";
import TemplateData from "../src/Data/TemplateData.js";
import Pagination from "../src/Plugins/Pagination.js";
import FileSystemSearch from "../src/FileSystemSearch.js";
import ExtensionMap from "../src/ExtensionMap.js";
import getNewTemplate from "./_getNewTemplateForTests.js";
import { getRenderedTemplates as getRenderedTmpls, renderTemplate } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstance } from "./_testHelpers.js";

test("No data passed to pagination", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/notpaged.njk",
    "./test/stubs/",
    "./dist",
  );

  let paging = new Pagination(tmpl, {}, tmpl.config);

  t.assert.strictEqual(paging.pagedItems.length, 0);
  t.assert.strictEqual((await paging.getPageTemplates()).length, 0);
});

test("No pagination", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/notpaged.njk",
    "./test/stubs/",
    "./dist",
  );

  let data = await tmpl.getData();
  let paging = new Pagination(tmpl, data, tmpl.config);
  paging.setTemplate(tmpl);

  t.assert.ok(!data.pagination);
  t.assert.strictEqual(paging.getPageCount(), 0);
  t.assert.strictEqual(paging.pagedItems.length, 0);
  t.assert.strictEqual((await paging.getPageTemplates()).length, 0);
});

test("Empty paged data", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/paged-empty.njk",
    "./test/stubs/",
    "./dist",
  );

  let data = await tmpl.getData();
  let paging = new Pagination(tmpl, data, tmpl.config);
  paging.setTemplate(tmpl);

  t.assert.strictEqual(paging.getPageCount(), 0);
  t.assert.strictEqual(paging.pagedItems.length, 0);
  t.assert.strictEqual((await paging.getPageTemplates()).length, 0);
});

test("Empty paged data with generatePageOnEmptyData enabled", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/paged-empty-pageonemptydata.njk",
    "./test/stubs/",
    "./dist",
  );

  let data = await tmpl.getData();
  let paging = new Pagination(tmpl, data, tmpl.config);
  paging.setTemplate(tmpl);

  t.assert.strictEqual(paging.getPageCount(), 1);
  t.assert.strictEqual(paging.pagedItems.length, 1);
  t.assert.strictEqual((await paging.getPageTemplates()).length, 1);
});

test("Pagination enabled in frontmatter", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedresolve.njk",
    "./test/stubs/",
    "./dist",
  );

  let data = await tmpl.getData();
  let paging = new Pagination(tmpl, data, tmpl.config);
  paging.setTemplate(tmpl);

  t.assert.ok(data.testdata);
  t.assert.ok(data.testdata.sub);

  t.assert.ok(data.pagination);
  t.assert.strictEqual(data.pagination.data, "testdata.sub");
  t.assert.strictEqual(paging.getPageCount(), 2);
  t.assert.strictEqual(data.pagination.size, 4);
});

test("Resolve paged data in frontmatter", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedresolve.njk",
    "./test/stubs/",
    "./dist",
  );

  let data = await tmpl.getData();
  let paging = new Pagination(tmpl, data, tmpl.config);
  paging.setTemplate(tmpl);
  t.assert.strictEqual(paging._resolveItems().length, 8);
  t.assert.strictEqual(paging.getPageCount(), 2);
  t.assert.strictEqual(paging.pagedItems.length, 2);
});

test("Paginate data in frontmatter", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedinlinedata.njk",
    "./test/stubs/",
    "./dist",
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.assert.strictEqual(pages.length, 2);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/pagedinlinedata/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[0].template, pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li></ol>"
  );

  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/pagedinlinedata/1/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[1].template, pages[1].data)).trim(),
    "<ol><li>item5</li><li>item6</li><li>item7</li><li>item8</li></ol>"
  );
});

test("Paginate external data file", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist",
    }
  });

  let dataObj = new TemplateData($config);
  dataObj.extensionMap = new ExtensionMap($config);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/paged/paged.njk",
    "./test/stubs/",
    "./dist",
    dataObj,
    null,
    $config
  );

  let data = await tmpl.getData();

  // local data
  t.assert.ok(data.items.sub.length);

  let pages = await tmpl.getTemplates(data);
  t.assert.strictEqual(pages.length, 2);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[0].template, pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li><li>item5</li></ol>"
  );

  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/1/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[1].template, pages[1].data)).trim(),
    "<ol><li>item6</li><li>item7</li><li>item8</li></ol>"
  );
});

test("Permalink with pagination variables", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalink.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/slug-candidate/index.html");
  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/another-slug-candidate/index.html");
});

test("Permalink with pagination variables (numeric)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinknumeric.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.ok(pages[0].data.pagination.firstPageLink);
  t.assert.ok(pages[0].data.pagination.firstPageHref);
  t.assert.ok(pages[0].data.pagination.lastPageLink);
  t.assert.ok(pages[0].data.pagination.lastPageHref);
  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/page-0/index.html");
  t.assert.ok(!(pages[0].data.pagination.previousPageLink));
  t.assert.strictEqual(pages[0].data.pagination.nextPageLink, "/paged/page-1/index.html");
  t.assert.strictEqual(pages[0].data.pagination.nextPageHref, "/paged/page-1/");
  t.assert.strictEqual(pages[0].data.pagination.pageLinks.length, 2);
  t.assert.strictEqual(pages[0].data.pagination.links.length, 2);
  t.assert.strictEqual(pages[0].data.pagination.hrefs.length, 2);

  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/page-1/index.html");
  t.assert.strictEqual(pages[1].data.pagination.previousPageLink, "/paged/page-0/index.html");
  t.assert.strictEqual(pages[1].data.pagination.previousPageHref, "/paged/page-0/");
  t.assert.ok(!(pages[1].data.pagination.nextPageLink));
  t.assert.strictEqual(pages[1].data.pagination.pageLinks.length, 2);
  t.assert.strictEqual(pages[1].data.pagination.links.length, 2);
  t.assert.strictEqual(pages[1].data.pagination.hrefs.length, 2);
});

test("Pagination links with a leading slash permalink, issue #1350", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinkleadingslash.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.deepStrictEqual(pages[0].data.pagination.links, ["/paged/page-0/index.html", "/paged/page-1/index.html"]);
  t.assert.strictEqual(pages[0].data.pagination.nextPageLink, "/paged/page-1/index.html");
  t.assert.strictEqual(pages[1].data.pagination.previousPageLink, "/paged/page-0/index.html");
  t.assert.strictEqual(pages[1].data.pagination.firstPageLink, "/paged/page-0/index.html");
  t.assert.deepStrictEqual(pages[0].data.pagination.hrefs, ["/paged/page-0/", "/paged/page-1/"]);
});

test("Permalink with pagination variables (numeric, one indexed)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinknumericoneindexed.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/page-1/index.html");
  t.assert.ok(!(pages[0].data.pagination.previousPageLink));
  t.assert.strictEqual(pages[0].data.pagination.nextPageLink, "/paged/page-2/index.html");
  t.assert.strictEqual(pages[0].data.pagination.nextPageHref, "/paged/page-2/");
  t.assert.strictEqual(pages[0].data.pagination.pageLinks.length, 2);
  t.assert.strictEqual(pages[0].data.pagination.links.length, 2);
  t.assert.strictEqual(pages[0].data.pagination.hrefs.length, 2);

  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/page-2/index.html");
  t.assert.strictEqual(pages[1].data.pagination.previousPageLink, "/paged/page-1/index.html");
  t.assert.strictEqual(pages[1].data.pagination.previousPageHref, "/paged/page-1/");
  t.assert.ok(!(pages[1].data.pagination.nextPageLink));
  t.assert.strictEqual(pages[1].data.pagination.pageLinks.length, 2);
  t.assert.strictEqual(pages[1].data.pagination.links.length, 2);
  t.assert.strictEqual(pages[1].data.pagination.hrefs.length, 2);
});

test("Permalink first and last page link with pagination variables (numeric)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinknumeric.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(pages[0].data.pagination.firstPageLink, "/paged/page-0/index.html");
  t.assert.strictEqual(pages[0].data.pagination.lastPageLink, "/paged/page-1/index.html");

  t.assert.strictEqual(pages[1].data.pagination.firstPageLink, "/paged/page-0/index.html");
  t.assert.strictEqual(pages[1].data.pagination.lastPageLink, "/paged/page-1/index.html");
});

test("Permalink first and last page link with pagination variables (numeric, one indexed)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinknumericoneindexed.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(pages[0].data.pagination.firstPageLink, "/paged/page-1/index.html");
  t.assert.strictEqual(pages[0].data.pagination.lastPageLink, "/paged/page-2/index.html");

  t.assert.strictEqual(pages[1].data.pagination.firstPageLink, "/paged/page-1/index.html");
  t.assert.strictEqual(pages[1].data.pagination.lastPageLink, "/paged/page-2/index.html");
});

test("Alias to page data", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/paged/pagedalias.njk", "./test/stubs/", "./dist");

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(pages[0].outputPath, "./dist/pagedalias/item1/index.html");
  t.assert.strictEqual(pages[1].outputPath, "./dist/pagedalias/item2/index.html");

  t.assert.strictEqual((await renderTemplate(pages[0].template, pages[0].data)).trim(), "item1");
  t.assert.strictEqual((await renderTemplate(pages[1].template, pages[1].data)).trim(), "item2");
});

test("Alias to page data (size 2)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedaliassize2.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(pages[0].outputPath, "./dist/pagedalias/item1/index.html");
  t.assert.strictEqual(pages[1].outputPath, "./dist/pagedalias/item3/index.html");

  t.assert.strictEqual((await renderTemplate(pages[0].template, pages[0].data)).trim(), "item1");
  t.assert.strictEqual((await renderTemplate(pages[1].template, pages[1].data)).trim(), "item3");
});

test("Permalink with pagination variables (and an if statement, nunjucks)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinkif.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/index.html");
  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/page-1/index.html");
});

test("Permalink with pagination variables (and an if statement, liquid)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinkif.liquid",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/index.html");
  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/page-1/index.html");
});

test("Template with Pagination", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinkif.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let outputPath = await tmpl.getOutputPath(data);
  t.assert.strictEqual(outputPath, "./dist/paged/index.html");

  let templates = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(templates.length, 2);
});

test("Issue 135", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist",
    }
  });

  let dataObj = new TemplateData($config);
  dataObj.extensionMap = new ExtensionMap($config);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/issue-135/template.njk",
    "./test/stubs/",
    "./dist",
    dataObj,
    null,
    $config
  );

  let data = await tmpl.getData();
  let templates = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(data.articles.length, 1);
  t.assert.strictEqual(data.articles[0].title, "Do you even paginate bro?");
  t.assert.strictEqual(await templates[0].outputPath, "./dist/blog/do-you-even-paginate-bro/index.html");

  let pages = await tmpl.getTemplates(data);
  t.assert.strictEqual(pages.length, 1);
  t.assert.strictEqual(pages[0].outputPath, "./dist/blog/do-you-even-paginate-bro/index.html");
});

test("Template with Pagination, getTemplates has page variables set", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinkif.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.assert.strictEqual(templates[0].data.page.url, "/paged/");
  t.assert.strictEqual(templates[0].data.page.outputPath, "./dist/paged/index.html");

  t.assert.strictEqual(templates[1].data.page.url, "/paged/page-1/");
  t.assert.strictEqual(templates[1].data.page.outputPath, "./dist/paged/page-1/index.html");
});

test("Template with Pagination, has page variables set", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedpermalinkif.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].data.page.url, "/paged/");
  t.assert.strictEqual(pages[0].data.page.outputPath, "./dist/paged/index.html");

  t.assert.strictEqual(pages[1].data.page.url, "/paged/page-1/");
  t.assert.strictEqual(pages[1].data.page.outputPath, "./dist/paged/page-1/index.html");
});

test("Page over an object (use keys)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/paged/pagedobject.njk", "./test/stubs/", "./dist");

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.assert.strictEqual(pages.length, 3);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/pagedobject/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[0].template, pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li></ol>"
  );

  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/pagedobject/1/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[1].template, pages[1].data)).trim(),
    "<ol><li>item5</li><li>item6</li><li>item7</li><li>item8</li></ol>"
  );
});

test("Page over an object (use values)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedobjectvalues.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.assert.strictEqual(pages.length, 3);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/pagedobjectvalues/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[0].template, pages[0].data)).trim(),
    "<ol><li>itemvalue1</li><li>itemvalue2</li><li>itemvalue3</li><li>itemvalue4</li></ol>"
  );

  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/pagedobjectvalues/1/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[1].template, pages[1].data)).trim(),
    "<ol><li>itemvalue5</li><li>itemvalue6</li><li>itemvalue7</li><li>itemvalue8</li></ol>"
  );
});

test("Page over an object (filtered, array)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedobjectfilterarray.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(
    (await renderTemplate(pages[0].template, pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item5</li></ol>"
  );

  t.assert.strictEqual(
    (await renderTemplate(pages[1].template, pages[1].data)).trim(),
    "<ol><li>item6</li><li>item7</li><li>item8</li><li>item9</li></ol>"
  );
});

test("Page over an object (filtered, string)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedobjectfilterstring.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.assert.strictEqual(pages.length, 2);

  t.assert.strictEqual(
    (await renderTemplate(pages[0].template, pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item5</li></ol>"
  );

  t.assert.strictEqual(
    (await renderTemplate(pages[1].template, pages[1].data)).trim(),
    "<ol><li>item6</li><li>item7</li><li>item8</li><li>item9</li></ol>"
  );
});

test("Pagination with deep data merge #147", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist",
    }
  });

  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedinlinedata.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    $config
  );
  tmpl.config.keys.layout = "layout";

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.assert.strictEqual(pages.length, 2);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/pagedinlinedata/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[0].template, pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li></ol>"
  );

  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/pagedinlinedata/1/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[1].template, pages[1].data)).trim(),
    "<ol><li>item5</li><li>item6</li><li>item7</li><li>item8</li></ol>"
  );
});

test("Pagination with deep data merge with alias #147", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/paged/pagedalias.njk", "./test/stubs/", "./dist");
  tmpl.config.dynamicPermalinks = true;

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.assert.strictEqual(pages[0].outputPath, "./dist/pagedalias/item1/index.html");
  t.assert.strictEqual(pages[1].outputPath, "./dist/pagedalias/item2/index.html");

  t.assert.strictEqual((await renderTemplate(pages[0].template, pages[0].data)).trim(), "item1");
  t.assert.strictEqual((await renderTemplate(pages[1].template, pages[1].data)).trim(), "item2");
});

test("Paginate data in frontmatter (reversed)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedinlinedata-reverse.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.assert.strictEqual(pages.length, 2);

  t.assert.strictEqual(pages[0].outputPath, "./dist/paged/pagedinlinedata-reverse/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[0].template, pages[0].data)).trim(),
    "<ol><li>item8</li><li>item7</li><li>item6</li><li>item5</li></ol>"
  );

  t.assert.strictEqual(pages[1].outputPath, "./dist/paged/pagedinlinedata-reverse/1/index.html");
  t.assert.strictEqual(
    (await renderTemplate(pages[1].template, pages[1].data)).trim(),
    "<ol><li>item4</li><li>item3</li><li>item2</li><li>item1</li></ol>"
  );
});

test("No circular dependency (does not throw)", async (t) => {
  let $config = await getTemplateConfigInstance();

  new Pagination(
    null,
    {
      collections: {
        tag1: [],
      },
      pagination: {
        data: "collections.tag1",
        size: 1,
      },
      tags: ["tag2"],
    },
    $config.getConfig()
  );

  t.assert.strictEqual(true, true);
});

test("Circular dependency (pagination iterates over tag1 but also supplies pages to tag1)", async (t) => {
  await t.assert.rejects(async () => {
    let $config = await getTemplateConfigInstance();

    new Pagination(
      null,
      {
        collections: {
          tag1: [],
          tag2: [],
        },
        pagination: {
          data: "collections.tag1",
          size: 1,
        },
        tags: ["tag1"],
      },
      $config.getConfig()
    );
  });
});

test("Circular dependency but should not error because it uses eleventyExcludeFromCollections", async (t) => {
  let $config = await getTemplateConfigInstance();

  new Pagination(
    null,
    {
      eleventyExcludeFromCollections: true,
      collections: {
        tag1: [],
        tag2: [],
      },
      pagination: {
        data: "collections.tag1",
        size: 1,
      },
      tags: ["tag1"],
    },
    $config.getConfig()
  );

  t.assert.strictEqual(true, true);
});

test("Pagination `before` Callback", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/paged/paged-before.njk", "./test/stubs/", "./dist");

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.assert.deepStrictEqual(templates[0].data.pagination.items, ["item6"]);
  t.assert.deepStrictEqual(templates[0].data.myalias, "item6");
});

test("Pagination `before` Callback with metadata", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/paged-before-metadata.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.assert.deepStrictEqual(templates[0].data.pagination.items, ["item3"]);
});

test("Pagination `before` Callback with a Filter", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/paged-before-filter.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.assert.deepStrictEqual(templates[0].data.pagination.items, ["item2"]);
  t.assert.deepStrictEqual(templates[0].data.myalias, "item2");
});

test("Pagination `before` Callback with `reverse: true` (test order of operations)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/paged-before-and-reverse.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.assert.deepStrictEqual(templates[0].data.pagination.items, ["item2"]);
});

test("Pagination new v0.10.0 href/hrefs", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist",
    }
  });

  let dataObj = new TemplateData($config);
  dataObj.extensionMap = new ExtensionMap($config);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/paged/paged.njk",
    "./test/stubs/",
    "./dist",
    dataObj,
    null,
    $config
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.assert.strictEqual(templates[0].data.pagination.hrefs.length, 2);
  t.assert.ok(templates[0].data.pagination.href.first);
  t.assert.ok(templates[0].data.pagination.href.last);
  t.assert.ok(!(templates[0].data.pagination.href.previous));
  t.assert.ok(templates[0].data.pagination.href.next);

  t.assert.strictEqual(templates[1].data.pagination.hrefs.length, 2);
  t.assert.ok(templates[1].data.pagination.href.first);
  t.assert.ok(templates[1].data.pagination.href.last);
  t.assert.ok(templates[1].data.pagination.href.previous);
  t.assert.ok(!(templates[1].data.pagination.href.next));
});

test("Pagination new v0.10.0 page/pages", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "dist",
    }
  });

  let dataObj = new TemplateData($config);
  dataObj.extensionMap = new ExtensionMap($config);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/paged/paged.njk",
    "./test/stubs/",
    "./dist",
    dataObj,
    null,
    $config
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.assert.strictEqual(templates[0].data.pagination.pages.length, 2);
  t.assert.strictEqual(templates[0].data.pagination.pages[0].length, 5);
  t.assert.strictEqual(templates[0].data.pagination.pages[1].length, 3);
  t.assert.ok(templates[0].data.pagination.page.first);
  t.assert.ok(templates[0].data.pagination.page.last);
  t.assert.ok(!(templates[0].data.pagination.page.previous));
  t.assert.ok(templates[0].data.pagination.page.next);

  t.assert.strictEqual(templates[1].data.pagination.pages.length, 2);
  t.assert.strictEqual(templates[1].data.pagination.pages[0].length, 5);
  t.assert.strictEqual(templates[1].data.pagination.pages[1].length, 3);
  t.assert.ok(templates[1].data.pagination.page.first);
  t.assert.ok(templates[1].data.pagination.page.last);
  t.assert.ok(templates[1].data.pagination.page.previous);
  t.assert.ok(!(templates[1].data.pagination.page.next));
});

test("Pagination new v0.10.0 alias", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/paged/pagedalias.njk", "./test/stubs/", "./dist");

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.assert.strictEqual(templates[0].data.pagination.alias, "font.test");
  t.assert.strictEqual(templates[1].data.pagination.alias, "font.test");
});

test("Pagination make sure pageNumber is numeric for {{ pageNumber + 1 }} Issue #760", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/paged/pagedinlinedata.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.assert.strictEqual(templates[0].data.pagination.pageNumber, 0);
  t.assert.notStrictEqual(templates[0].data.pagination.pageNumber, "0");
});

test("Pagination mutable global data", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/paged-global-data-mutable/",
      output: "dist",
    }
  });

  let dataObj = new TemplateData($config);
  dataObj.extensionMap = new ExtensionMap($config);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());
  await dataObj.getGlobalData();

  let tmpl = await getNewTemplate(
    "./test/stubs/paged-global-data-mutable/paged-differing-data-set.njk",
    "./test/stubs/paged-global-data-mutable/",
    "./dist",
    dataObj,
    null,
    $config
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.assert.strictEqual(templates.length, 3);
  t.assert.deepStrictEqual(templates[0].data.pagination.items[0], {
    key1: "item1",
    key2: "item2",
  });
  t.assert.deepStrictEqual(templates[1].data.pagination.items[0], {
    key3: "item3",
    key4: "item4",
  });
  t.assert.deepStrictEqual(templates[2].data.pagination.items[0], {
    key5: "item5",
    key6: "item6",
  });

  t.assert.deepStrictEqual(templates[0].data.item, { key1: "item1", key2: "item2" });
  t.assert.deepStrictEqual(templates[1].data.item, { key3: "item3", key4: "item4" });
  t.assert.deepStrictEqual(templates[2].data.item, { key5: "item5", key6: "item6" });
});

test("Pagination template/dir data files run once, Issue 919", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs-919",
      output: "dist",
    }
  });

  let dataObj = new TemplateData($config);
  dataObj.extensionMap = new ExtensionMap($config);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs-919/test.njk",
    "./test/stubs-919/",
    "./dist",
    dataObj,
    null,
    $config
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.assert.strictEqual(templates.length, 3);
  t.assert.strictEqual(templates[0].data.test, templates[1].data.test);
  t.assert.strictEqual(templates[1].data.test, templates[2].data.test);
});

test("Pagination and eleventyComputed permalink, issue #1555 and #1865", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/pagination-eleventycomputed-permalink.liquid",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.assert.strictEqual(templates[0].data.page.url, "/venues/first/");
  t.assert.strictEqual(templates[1].data.page.url, "/venues/second/");
  t.assert.strictEqual(templates[2].data.page.url, "/venues/third/");
});

test("Pagination and eleventyComputed data, issues #2512, #2837, #3013", async (t) => {
  let templateLangs = ["liquid", "html", "md", "njk"];
  let apostrophe = {
    liquid: "'",
    html: "'",
    md: "'",
    hbs: "&amp;#x27;",
    mustache: "&amp;#39;",
    njk: "&amp;#39;",
  };

  for (let lang of templateLangs) {
    let msg = `lang: ${lang}`;
    let le = lang === "md" ? "\n" : "";

    let elev = new Eleventy(`./test/stubs-3013/${lang}/`, `./test/stubs-3013/${lang}/_site`, {
      source: "cli",
      runMode: "build",
    });
    await elev.init();
    let written = await elev.toJSON();

    t.assert.strictEqual(written[0].url, "/paul-mescal/", msg);
    t.assert.strictEqual(written[0].content, `<title>The Effervescent adventures of Paul Mescal</title>${le}`, msg);
    t.assert.strictEqual(written[1].url, "/populace-and-power/", msg);
    t.assert.strictEqual(
      written[1].content,
      `<title>Populace and Power: A user${apostrophe[lang]}s guide</title>${le}`,
      msg
    );
  }
});

test("Pagination data keys and values are stable", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: (eleventyConfig) => {
      eleventyConfig.addTemplate(
        "paged.11ty.js",
        ({ pagination }) =>
          JSON.stringify({
            keys: Object.keys(pagination),
            pageNumber: pagination.pageNumber,
            items: pagination.items,
            page: pagination.page,
            previous: pagination.previous,
            next: pagination.next,
            hrefs: pagination.hrefs,
            href: pagination.href,
          }),
        { pagination: { data: "letters", size: 1 }, letters: ["a", "b", "c"] },
      );
    },
  });

  let results = await elev.toJSON();
  let second = JSON.parse(results.find((entry) => entry.url === "/paged/1/").content);
  t.assert.deepStrictEqual(second, {
    keys: [
      "data", "size", "alias", "pages", "items", "page", "pageNumber",
      "previousPageLink", "previous", "nextPageLink", "next", "firstPageLink", "lastPageLink",
      "links", "pageLinks", "previousPageHref", "nextPageHref", "firstPageHref", "lastPageHref",
      "hrefs", "href",
    ],
    pageNumber: 1,
    items: ["b"],
    page: { previous: "a", next: "c", first: "a", last: "c" },
    previous: "/paged/index.html",
    next: "/paged/2/index.html",
    hrefs: ["/paged/", "/paged/1/", "/paged/2/"],
    href: { previous: "/paged/", next: "/paged/2/", first: "/paged/", last: "/paged/2/" },
  });
});

test("Paginated Nunjucks templates share a compiled template but render each page", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: (eleventyConfig) => {
      eleventyConfig.addTemplate("paged.njk", `{% set tag = "b" %}<{{ tag }}>{{ item }}</{{ tag }}>`, {
        pagination: { data: "letters", size: 1, alias: "item" },
        letters: ["a", "b", "c"],
        permalink: "/{{ item }}/",
      });
    },
  });

  let results = await elev.toJSON();
  t.assert.deepStrictEqual(
    results.map(({ url, content }) => [url, content]).sort(),
    [["/a/", "<b>a</b>"], ["/b/", "<b>b</b>"], ["/c/", "<b>c</b>"]],
  );
});
