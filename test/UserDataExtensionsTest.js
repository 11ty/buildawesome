import test from "node:test";
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
  t.assert.strictEqual(data.globalData3.datakey1, "datavalue3");
  t.assert.strictEqual(data.globalData3.datakey2, "{{pkg.name}}--yaml");

  // NOSJ (JSON) GLOBAL DATA
  t.assert.strictEqual(data.globalData4.datakey1, "datavalue4");
  t.assert.strictEqual(data.globalData4.datakey2, "{{pkg.name}}--nosj");

  let withLocalData = await dataObj.getTemplateDirectoryData(
    "./test/stubs-630/component-yaml/component.njk"
  );

  t.assert.strictEqual(withLocalData.yamlKey1, "yaml1");
  t.assert.strictEqual(withLocalData.yamlKey2, "yaml2");
  t.assert.strictEqual(withLocalData.yamlKey3, "yaml3");
  t.assert.strictEqual(withLocalData.nosjKey1, "nosj1");
  t.assert.strictEqual(withLocalData.jsonKey1, "json1");
  t.assert.strictEqual(withLocalData.jsonKey2, "json2");
  t.assert.strictEqual(withLocalData.jsKey1, "js1");
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
  t.assert.deepStrictEqual(files, [
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

  t.assert.deepStrictEqual(dataObj.getGlobalDataGlob(), [
    `./test/stubs-630/_data/**/*.{nosj,yaml,json,mjs,cjs,js${isTypeScriptSupported() ? ",mts,cts,ts" : ""}}`,
  ]);

  let data = await dataObj.getGlobalData();

  // JS GLOBAL DATA
  t.assert.strictEqual(data.globalData0.datakey1, "datavalue0");

  // CJS GLOBAL DATA
  t.assert.strictEqual(data.globalData1.datakey1, "datavalue1");

  // JSON GLOBAL DATA
  t.assert.strictEqual(data.globalData2.datakey1, "datavalue2");
  t.assert.strictEqual(data.globalData2.datakey2, "{{pkg.name}}--json");

  // YAML GLOBAL DATA
  t.assert.strictEqual(data.globalData3.datakey1, "datavalue3");
  t.assert.strictEqual(data.globalData3.datakey2, "{{pkg.name}}--yaml");

  // NOSJ (JSON) GLOBAL DATA
  t.assert.strictEqual(data.globalData4.datakey1, "datavalue4");
  t.assert.strictEqual(data.globalData4.datakey2, "{{pkg.name}}--nosj");

  t.assert.strictEqual(data.subdir.globalDataSubdir.keyyaml, "yaml");
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
  t.assert.strictEqual(data.mergingGlobalData.datakey0, "js-value0");
  t.assert.strictEqual(data.mergingGlobalData.datakey1, "cjs-value1");
  t.assert.strictEqual(data.mergingGlobalData.datakey2, "json-value2");
  t.assert.strictEqual(data.mergingGlobalData.datakey3, "yaml-value3");
  t.assert.strictEqual(data.mergingGlobalData.datakey4, "nosj-value4");

  t.assert.strictEqual(data.mergingGlobalData.jskey, "js");
  t.assert.strictEqual(data.mergingGlobalData.cjskey, "cjs");
  t.assert.strictEqual(data.mergingGlobalData.jsonkey, "json");
  t.assert.strictEqual(data.mergingGlobalData.yamlkey, "yaml");
  t.assert.strictEqual(data.mergingGlobalData.nosjkey, "nosj");
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
          t.assert.strictEqual(Buffer.isBuffer(s), true);
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
  t.assert.strictEqual(data.images.dog, 43183);
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
          t.assert.strictEqual(fs.existsSync(s), true);
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
  t.assert.strictEqual(data.images.dog, "./test/stubs-2378/_data/images/dog.jpg");
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
          t.assert.strictEqual(Buffer.isBuffer(s), true);
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
  t.assert.strictEqual(data.images.dog, 43183);
  t.assert.strictEqual(data.images.dogpng, 2890);
});

test("Missing `parser` property to addDataExtension object throws error", async (t) => {
  let eleventyConfig = new TemplateConfig();
  t.assert.throws(() => {
    eleventyConfig.userConfig.addDataExtension("jpg", {});
  }, {
    message: "Expected `parser` property in second argument object to `eleventyConfig.addDataExtension`"
  });
});

test("Async parser rejection is wrapped with the data file path", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-630"
    },
    function(cfg) {
      cfg.addDataExtension("yaml", {
        parser: async () => {
          throw new Error("Async parser failure");
        },
      });
    }
  );

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  dataObj.setFileSystemSearch(new FileSystemSearch());

  let e;
  await t.assert.rejects(() => dataObj.getGlobalData(), (err) => {
  	e = err;
  	return true;
  });

  t.assert.strictEqual(e.message.startsWith("Having trouble parsing data file"), true);
  t.assert.strictEqual(e.filePath.endsWith(".yaml"), true);
});
