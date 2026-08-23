import test from "ava";

import TemplateData from "../src/Data/TemplateData.js";
import ExtensionMap from "../src/ExtensionMap.js";

import getNewTemplate from "./_getNewTemplateForTests.js";
import { renderTemplate } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

test("Custom extension (.txt) with custom permalink compile function", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist",
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
        // pass in your own custom permalink function.
        permalink: async function (permalinkString, inputPath) {
          t.is(permalinkString, "custom-extension.lit");
          t.is(inputPath, "./test/stubs/custom-extension.txt");
          return async function () {
            return "HAHA_THIS_ALWAYS_GOES_HERE.txt";
          };
        },
      },
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "Sample content");
  let testObj = await tmpl.getOutputLocations(data);
  t.is(testObj.href, "/HAHA_THIS_ALWAYS_GOES_HERE.txt");
  t.is(testObj.path, "./dist/HAHA_THIS_ALWAYS_GOES_HERE.txt");
  t.is(testObj.rawPath, "HAHA_THIS_ALWAYS_GOES_HERE.txt");
});

test("Custom extension with and compileOptions.permalink = false", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist",
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
        permalink: false,
      },
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "Sample content");
  let testObj = await tmpl.getOutputLocations(data);
  t.is(testObj.href, false);
  t.is(testObj.path, false);
  t.is(testObj.rawPath, false);
});

test("Custom extension with and opt-out of permalink compilation", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist",
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
        permalink: "raw",
      },
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "Sample content");
  let testObj = await tmpl.getOutputLocations(data);
  t.is(testObj.href, "/custom-extension.lit");
  t.is(testObj.path, "./dist/custom-extension.lit");
  t.is(testObj.rawPath, "custom-extension.lit");
});

test("Custom extension (.txt) with custom permalink compile function but no permalink in the data cascade", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist",
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
        // pass in your own custom permalink function.
        permalink: async function (permalinkString, inputPath) {
          t.is(permalinkString, undefined);
          t.is(inputPath, "./test/stubs/custom-extension-no-permalink.txt");

          return async function () {
            return "HAHA_THIS_ALWAYS_GOES_HERE.txt";
          };
        },
      },
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension-no-permalink.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "Sample content");
  let testObj = await tmpl.getOutputLocations(data);
  t.is(testObj.href, "/HAHA_THIS_ALWAYS_GOES_HERE.txt");
  t.is(testObj.path, "./dist/HAHA_THIS_ALWAYS_GOES_HERE.txt");
  t.is(testObj.rawPath, "HAHA_THIS_ALWAYS_GOES_HERE.txt");
});

test("Custom extension (.txt) with custom permalink compile function (that returns a string not a function) but no permalink in the data cascade", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist",
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
        permalink: async function (permalinkString, inputPath) {
          t.is(permalinkString, undefined);
          t.is(inputPath, "./test/stubs/custom-extension-no-permalink.txt");

          // unique part of this test: this is a string, not a function
          return "HAHA_THIS_ALWAYS_GOES_HERE.txt";
        },
      },
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension-no-permalink.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "Sample content");
  let testObj = await tmpl.getOutputLocations(data);
  t.is(testObj.href, "/HAHA_THIS_ALWAYS_GOES_HERE.txt");
  t.is(testObj.path, "./dist/HAHA_THIS_ALWAYS_GOES_HERE.txt");
  t.is(testObj.rawPath, "HAHA_THIS_ALWAYS_GOES_HERE.txt");
});

test("Custom extension (.txt) with custom permalink compile function that returns false", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist",
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
        permalink: async function (permalinkString, inputPath) {
          t.is(permalinkString, undefined);
          t.is(inputPath, "./test/stubs/custom-extension-no-permalink.txt");

          // unique part of this test: this returns false
          return false;
        },
      },
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension-no-permalink.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "Sample content");
  let testObj = await tmpl.getOutputLocations(data);
  t.is(testObj.href, false);
  t.is(testObj.path, false);
  t.is(testObj.rawPath, false);
});

test("Custom extension (.txt) that returns undefined from compile", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist",
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
      },
      compile: function (str, inputPath) {
        t.is(str, "Sample content");
        return function (data) {
          return undefined;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);

  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension-no-permalink.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), undefined);
  let pages = await tmpl.getTemplates(data);
  for (let page of pages) {
    page.templateContent = undefined;
    t.is(page.templateContent, undefined); // shouldn’t throw an error
  }
});
