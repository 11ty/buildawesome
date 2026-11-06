import test from "node:test";
import ReservedData from "../src/Util/ReservedData.js";
import Eleventy from "../src/Core.js";

test("No reserved Keys", t => {
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ key: {} }).sort(), []);
});

test("Standard keys are reserved", t => {
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ content: "" }).sort(), ["content"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ collections: {} }).sort(), ["collections"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ content: "", collections: {} }).sort(), ["collections", "content"]);
});

test("`page` subkeys", t => {
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: {} }).sort(), []);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: "" }).sort(), ["page"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: { date: "", otherkey: "" } }).sort(), ["page.date"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: { inputPath: "", otherkey: "" } }).sort(), ["page.inputPath"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: { fileSlug: "", otherkey: "" } }).sort(), ["page.fileSlug"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: { filePathStem: "", otherkey: "" } }).sort(), ["page.filePathStem"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: { outputFileExtension: "", otherkey: "" } }).sort(), ["page.outputFileExtension"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: { templateSyntax: "", otherkey: "" } }).sort(), ["page.templateSyntax"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: { url: "", otherkey: "" } }).sort(), ["page.url"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: { outputPath: "", otherkey: "" } }).sort(), ["page.outputPath"]);
  t.assert.deepStrictEqual(ReservedData.getReservedKeys({ page: { date: "", outputPath: "", otherkey: "" } }).sort(), ["page.date", "page.outputPath"]);
});

test("Eleventy freeze data set via config API throws error (page)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    configPath: "./test/stubs-virtual/eleventy.config.js",
    config: $config => {
      $config.addGlobalData("page", "lol no");
      $config.addTemplate("index.html", ``);
    }
  });
  elev.disableLogger();

  await t.assert.rejects(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names: page (source: ./test/stubs-virtual/eleventy.config.js). You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });
});

test("Eleventy freeze data set via config API throws error (eleventy)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    configPath: "./test/stubs-virtual/eleventy.config.js",
    config: $config => {
      $config.addGlobalData("eleventy", "lol no");
      $config.addTemplate("index.html", ``);
    }
  });
  elev.disableLogger();

  await t.assert.rejects(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names: eleventy (source: ./test/stubs-virtual/eleventy.config.js). You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });
});

test("Eleventy freeze data set global data file throws error (page)", async (t) => {
  let elev = new Eleventy({
    input: "./test/stubs-freeze/page/",
    config: $config => {
      $config.addTemplate("index.html", ``);
    }
  });
  elev.disableLogger();

  await t.assert.rejects(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names: page.url (source: ./test/stubs-freeze/page/_data/page.js). You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });
});

test("Eleventy freeze data set global data file throws error (eleventy)", async (t) => {
  let elev = new Eleventy({
    input: "./test/stubs-freeze/eleventy/",
    config: $config => {
      $config.addTemplate("index.html", ``);
    }
  });
  elev.disableLogger();

  await t.assert.rejects(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names: eleventy (source: ./test/stubs-freeze/eleventy/_data/eleventy.js). You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });
});

test("Eleventy freeze data written in a global data function throws error #4341", async (t) => {
  let elev = new Eleventy({
    input: "./test/stubs-freeze/eleventy-fn/",
    config: $config => {
      $config.addTemplate("index.html", ``);
    }
  });
  elev.disableLogger();

  await t.assert.rejects(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names (source: ./test/stubs-freeze/eleventy-fn/_data/meta.js). You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });
});
