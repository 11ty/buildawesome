import test from "ava";
import fs from "fs";
import { load } from "js-yaml";

import TemplateConfig from "../src/TemplateConfig.js";
import FileSystemSearch from "../src/FileSystemSearch.js";
import TemplateData from "../src/Data/TemplateData.js";
import { isTypeScriptSupported } from "../src/Util/TypeScriptFeatureTest.cjs";

import { getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";
import ExtensionMap from "../src/ExtensionMap.js";

test("Local data", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-630"
    },
    function(cfg) {
      cfg.addDataExtension("yaml", { parser: (s) => load(s) });
      cfg.addDataExtension("nosj", { parser: (s) => JSON.parse(s) });
    }
  );

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());

  let data = await dataObj.getGlobalData();

  // YAML GLOBAL DATA
  t.is(data.globalData3.datakey1, "datavalue3");
  t.is(data.globalData3.datakey2, "{{pkg.name}}--yaml");

  // NOSJ (JSON) GLOBAL DATA
  t.is(data.globalData4.datakey1, "datavalue4");
  t.is(data.globalData4.datakey2, "{{pkg.name}}--nosj");

  let withLocalData = await dataObj.getTemplateDirectoryData(
    "./test/stubs-630/component-yaml/component.njk"
  );

  t.is(withLocalData.yamlKey1, "yaml1");
  t.is(withLocalData.yamlKey2, "yaml2");
  t.is(withLocalData.yamlKey3, "yaml3");
  t.is(withLocalData.nosjKey1, "nosj1");
  t.is(withLocalData.jsonKey1, "json1");
  t.is(withLocalData.jsonKey2, "json2");
  t.is(withLocalData.jsKey1, "js1");
});

test("Local files", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-630"
    },
    function(cfg) {
      cfg.addDataExtension("yaml", { parser: (s) => load(s) });
      cfg.addDataExtension("nosj", { parser: (s) => JSON.parse(s) });
    }
  );

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let files = await dataObj.getLocalDataPaths("./test/stubs-630/component-yaml/component.njk");
  t.deepEqual(files, [
    "./test/stubs-630/stubs-630.yaml",
    "./test/stubs-630/stubs-630.nosj",
    "./test/stubs-630/stubs-630.json",

    "./test/stubs-630/stubs-630.11tydata.yaml",
    "./test/stubs-630/stubs-630.11tydata.nosj",
    "./test/stubs-630/stubs-630.11tydata.json",
    "./test/stubs-630/stubs-630.11tydata.mjs",
    "./test/stubs-630/stubs-630.11tydata.cjs",
    "./test/stubs-630/stubs-630.11tydata.js",
    "./test/stubs-630/stubs-630.11tydata.mts",
    "./test/stubs-630/stubs-630.11tydata.cts",
    "./test/stubs-630/stubs-630.11tydata.ts",

    "./test/stubs-630/stubs-630.data.yaml",
    "./test/stubs-630/stubs-630.data.nosj",
    "./test/stubs-630/stubs-630.data.json",
    "./test/stubs-630/stubs-630.data.mjs",
    "./test/stubs-630/stubs-630.data.cjs",
    "./test/stubs-630/stubs-630.data.js",
    "./test/stubs-630/stubs-630.data.mts",
    "./test/stubs-630/stubs-630.data.cts",
    "./test/stubs-630/stubs-630.data.ts",

    "./test/stubs-630/component-yaml/component-yaml.yaml",
    "./test/stubs-630/component-yaml/component-yaml.nosj",
    "./test/stubs-630/component-yaml/component-yaml.json",

    "./test/stubs-630/component-yaml/component-yaml.11tydata.yaml",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.nosj",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.json",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.mjs",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.cjs",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.js",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.mts",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.cts",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.ts",

    "./test/stubs-630/component-yaml/component-yaml.data.yaml",
    "./test/stubs-630/component-yaml/component-yaml.data.nosj",
    "./test/stubs-630/component-yaml/component-yaml.data.json",
    "./test/stubs-630/component-yaml/component-yaml.data.mjs",
    "./test/stubs-630/component-yaml/component-yaml.data.cjs",
    "./test/stubs-630/component-yaml/component-yaml.data.js",
    "./test/stubs-630/component-yaml/component-yaml.data.mts",
    "./test/stubs-630/component-yaml/component-yaml.data.cts",
    "./test/stubs-630/component-yaml/component-yaml.data.ts",

    "./test/stubs-630/component-yaml/component.yaml",
    "./test/stubs-630/component-yaml/component.nosj",
    "./test/stubs-630/component-yaml/component.json",

    "./test/stubs-630/component-yaml/component.11tydata.yaml",
    "./test/stubs-630/component-yaml/component.11tydata.nosj",
    "./test/stubs-630/component-yaml/component.11tydata.json",
    "./test/stubs-630/component-yaml/component.11tydata.mjs",
    "./test/stubs-630/component-yaml/component.11tydata.cjs",
    "./test/stubs-630/component-yaml/component.11tydata.js",
    "./test/stubs-630/component-yaml/component.11tydata.mts",
    "./test/stubs-630/component-yaml/component.11tydata.cts",
    "./test/stubs-630/component-yaml/component.11tydata.ts",

    "./test/stubs-630/component-yaml/component.data.yaml",
    "./test/stubs-630/component-yaml/component.data.nosj",
    "./test/stubs-630/component-yaml/component.data.json",
    "./test/stubs-630/component-yaml/component.data.mjs",
    "./test/stubs-630/component-yaml/component.data.cjs",
    "./test/stubs-630/component-yaml/component.data.js",
    "./test/stubs-630/component-yaml/component.data.mts",
    "./test/stubs-630/component-yaml/component.data.cts",
    "./test/stubs-630/component-yaml/component.data.ts",
  ]);
});

test("Global data", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-630"
    },
    function(cfg) {
      cfg.addDataExtension("yaml", { parser: (s) => load(s) });
      cfg.addDataExtension("nosj", { parser: (s) => JSON.parse(s) });
    }
  );

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());

  t.deepEqual(dataObj.getGlobalDataGlob(), [
    `./test/stubs-630/_data/**/*.{nosj,yaml,json,mjs,cjs,js${isTypeScriptSupported() ? ",mts,cts,ts" : ""}}`,
  ]);

  let data = await dataObj.getGlobalData();

  // JS GLOBAL DATA
  t.is(data.globalData0.datakey1, "datavalue0");

  // CJS GLOBAL DATA
  t.is(data.globalData1.datakey1, "datavalue1");

  // JSON GLOBAL DATA
  t.is(data.globalData2.datakey1, "datavalue2");
  t.is(data.globalData2.datakey2, "{{pkg.name}}--json");

  // YAML GLOBAL DATA
  t.is(data.globalData3.datakey1, "datavalue3");
  t.is(data.globalData3.datakey2, "{{pkg.name}}--yaml");

  // NOSJ (JSON) GLOBAL DATA
  t.is(data.globalData4.datakey1, "datavalue4");
  t.is(data.globalData4.datakey2, "{{pkg.name}}--nosj");

  t.is(data.subdir.globalDataSubdir.keyyaml, "yaml");
});

test("Global data merging and priority", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-630"
    },
    function(cfg) {
      cfg.addDataExtension("yaml", { parser: (s) => load(s) });
      cfg.addDataExtension("nosj", { parser: (s) => JSON.parse(s) });
    }
  );

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());

  let data = await dataObj.getGlobalData();

  // TESTING GLOBAL DATA PRIORITY AND MERGING
  t.is(data.mergingGlobalData.datakey0, "js-value0");
  t.is(data.mergingGlobalData.datakey1, "cjs-value1");
  t.is(data.mergingGlobalData.datakey2, "json-value2");
  t.is(data.mergingGlobalData.datakey3, "yaml-value3");
  t.is(data.mergingGlobalData.datakey4, "nosj-value4");

  t.is(data.mergingGlobalData.jskey, "js");
  t.is(data.mergingGlobalData.cjskey, "cjs");
  t.is(data.mergingGlobalData.jsonkey, "json");
  t.is(data.mergingGlobalData.yamlkey, "yaml");
  t.is(data.mergingGlobalData.nosjkey, "nosj");
});

test("Binary data files, encoding: null", async (t) => {
  t.plan(2);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-2378"
    },
    function(cfg) {
      cfg.addDataExtension("jpg", {
        parser: (s) => {
          t.true(Buffer.isBuffer(s));
          // s is a Buffer, just return the length as a sample
          return s.length;
        },
        encoding: null,
      });
    }
  );

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());

  let data = await dataObj.getGlobalData();
  t.is(data.images.dog, 43183);
});

test("Binary data files, read: false", async (t) => {
  t.plan(2);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-2378"
    },
    function(cfg) {
      cfg.addDataExtension("jpg", {
        parser: (s) => {
          t.true(fs.existsSync(s));
          // s is a Buffer, just return the length as a sample
          return s;
        },
        read: false,
      });
    }
  );

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());

  let data = await dataObj.getGlobalData();
  t.is(data.images.dog, "./test/stubs-2378/_data/images/dog.jpg");
});

test("Binary data files, encoding: null (multiple data extensions)", async (t) => {
  t.plan(4);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-2378"
    },
    function(cfg) {
      cfg.addDataExtension("jpg, png", {
        parser: function (s) {
          t.true(Buffer.isBuffer(s));
          // s is a Buffer, just return the length as a sample
          return s.length;
        },
        encoding: null,
      });
    }
  );

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());

  let data = await dataObj.getGlobalData();
  t.is(data.images.dog, 43183);
  t.is(data.images.dogpng, 2890);
});

test("Missing `parser` property to addDataExtension object throws error", async (t) => {
  let eleventyConfig = new TemplateConfig();
  t.throws(() => {
    eleventyConfig.userConfig.addDataExtension("jpg", {});
  }, {
    message: "Expected `parser` property in second argument object to `eleventyConfig.addDataExtension`"
  });
});
