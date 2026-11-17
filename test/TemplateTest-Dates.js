import test from "node:test";
import getNewTemplate from "./_getNewTemplateForTests.js";
import { getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

const VIRTUAL_DATES = {
  "dates/file2.md": `---
tags: dateTestTag
date: "2016-01-01"
---
`,
  "dates/file2b.md": `---
tags: dateTestTag
date: 2016-01-01
---
`,
  "dates/2018-01-01-file5.md": `---
tags: dateTestTag
---
`,
  "dates/2019-01-01-folder/2020-01-01-file.md": `---
---
`,
};

async function getVirtualTemplate(path) {
  let $config = await getTemplateConfigInstanceCustomCallback({ input: "./test/stubs/", output: "./dist" }, (cfg) => {
    cfg.addTemplate(path, VIRTUAL_DATES[path]);
  });
  return getNewTemplate(`./test/stubs/${path}`, "./test/stubs/", "./dist", null, null, $config);
}

async function getRenderedData(tmpl, pageNumber = 0) {
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  return templates[pageNumber].data;
}

test("getMappedDate (empty, assume created)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/dates/file1.md", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.assert.strictEqual(date instanceof Date, true);
  t.assert.ok(date.getTime());
});

test("getMappedDate (explicit date, yaml String)", async (t) => {
  let tmpl = await getVirtualTemplate("dates/file2.md");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.assert.strictEqual(date instanceof Date, true);
  t.assert.ok(date.getTime());
  t.assert.strictEqual(Date.UTC(2016, 0, 1), date.getTime());
});

test("getMappedDate (explicit date, yaml Date)", async (t) => {
  let tmpl = await getVirtualTemplate("dates/file2b.md");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.assert.strictEqual(date instanceof Date, true);
  t.assert.ok(date.getTime());
  t.assert.strictEqual(Date.UTC(2016, 0, 1), date.getTime());
});

test("getMappedDate (explicit date, yaml Date and string should be the same)", async (t) => {
  let tmplA = await getVirtualTemplate("dates/file2.md");
  let dataA = await getRenderedData(tmplA);
  let stringDate = await tmplA.getMappedDate(dataA.date, dataA.page);

  let tmplB = await getVirtualTemplate("dates/file2b.md");
  let dataB = await getRenderedData(tmplB);
  let yamlDate = await tmplB.getMappedDate(dataB.date, dataB.page);

  t.assert.ok(stringDate);
  t.assert.ok(yamlDate);
  t.assert.deepStrictEqual(stringDate, yamlDate);
});

test("getMappedDate (modified date)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/dates/file3.md", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.assert.strictEqual(date instanceof Date, true);
  t.assert.ok(date.getTime());
});

test("getMappedDate (created date)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/dates/file4.md", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.assert.strictEqual(date instanceof Date, true);
  t.assert.ok(date.getTime());
});

test("getMappedDate (falls back to filename date)", async (t) => {
  let tmpl = await getVirtualTemplate("dates/2018-01-01-file5.md");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.assert.strictEqual(date instanceof Date, true);
  t.assert.ok(date.getTime());
  t.assert.strictEqual(Date.UTC(2018, 0, 1), date.getTime());
});

test("getMappedDate (found multiple dates, picks first)", async (t) => {
  let tmpl = await getVirtualTemplate("dates/2019-01-01-folder/2020-01-01-file.md");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.assert.strictEqual(date instanceof Date, true);
  t.assert.ok(date.getTime());
  t.assert.strictEqual(Date.UTC(2019, 0, 1), date.getTime());
});
