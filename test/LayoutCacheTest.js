import test from "ava";

import templateCache from "../src/LayoutCache.js";
import getNewTemplate from "./_getNewTemplateForTests.js";

test("Cache can save templates", async (t) => {
  templateCache.clear();

  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");

  templateCache.add(tmpl);
  t.is(templateCache.size(), 1);
});

test("TemplateCache clear", async (t) => {
  templateCache.clear();

  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");

  templateCache.add(tmpl);
  t.is(templateCache.size(), 1);
  templateCache.clear();
  t.is(templateCache.size(), 0);
});

test("TemplateCache has", async (t) => {
  templateCache.clear();

  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");

  templateCache.add(tmpl);
  // Only TemplateLayout is cached
  t.is(templateCache.has("./test/stubs/template.liquid"), false);
});

test("TemplateCache get success", async (t) => {
  templateCache.clear();

  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");

  templateCache.add(tmpl);

  // Only TemplateLayout is cached
  t.throws(() => {
    templateCache.get("./test/stubs/template.liquid");
  });
});

test("TemplateCache get fail", async (t) => {
  templateCache.clear();

  let tmpl = await getNewTemplate("./test/stubs/template.liquid", "./test/stubs/", "./dist");

  templateCache.add(tmpl);
  t.throws(function () {
    templateCache.get("./test/stubs/template298374892.liquid");
  });
});
