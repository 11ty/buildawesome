import test from "ava";
import getNewTemplate from "./_getNewTemplateForTests.js";

async function getRenderedData(tmpl, pageNumber = 0) {
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  return templates[pageNumber].data;
}

test("getMappedDate (empty, assume created)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/dates/file1.md", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
});

test("getMappedDate (explicit date, yaml String)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/dates/file2.md", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
  t.is(Date.UTC(2016, 0, 1), date.getTime());
});

test("getMappedDate (explicit date, yaml Date)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/dates/file2b.md", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
  t.is(Date.UTC(2016, 0, 1), date.getTime());
});

test("getMappedDate (explicit date, yaml Date and string should be the same)", async (t) => {
  let tmplA = await getNewTemplate("./test/stubs/dates/file2.md", "./test/stubs/", "./dist");
  let dataA = await getRenderedData(tmplA);
  let stringDate = await tmplA.getMappedDate(dataA.date, dataA.page);

  let tmplB = await getNewTemplate("./test/stubs/dates/file2b.md", "./test/stubs/", "./dist");
  let dataB = await getRenderedData(tmplB);
  let yamlDate = await tmplB.getMappedDate(dataB.date, dataB.page);

  t.truthy(stringDate);
  t.truthy(yamlDate);
  t.deepEqual(stringDate, yamlDate);
});

test("getMappedDate (modified date)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/dates/file3.md", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
});

test("getMappedDate (created date)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/dates/file4.md", "./test/stubs/", "./dist");
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
});

test("getMappedDate (falls back to filename date)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/dates/2018-01-01-file5.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
  t.is(Date.UTC(2018, 0, 1), date.getTime());
});

test("getMappedDate (found multiple dates, picks first)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/dates/2019-01-01-folder/2020-01-01-file.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await getRenderedData(tmpl);
  let date = await tmpl.getMappedDate(data.date, data.page);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
  t.is(Date.UTC(2019, 0, 1), date.getTime());
});
