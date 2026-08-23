import test from "ava";
import ReservedData from "../src/Util/ReservedData.js";
import Eleventy from "../src/Core.js";

test("No reserved Keys", t => {
  t.deepEqual(ReservedData.getReservedKeys({ key: {} }).sort(), []);
});

test("Standard keys are reserved", t => {
  t.deepEqual(ReservedData.getReservedKeys({ content: "" }).sort(), ["content"]);
  t.deepEqual(ReservedData.getReservedKeys({ collections: {} }).sort(), ["collections"]);
  t.deepEqual(ReservedData.getReservedKeys({ content: "", collections: {} }).sort(), ["collections", "content"]);
});

test("`page` subkeys", t => {
  t.deepEqual(ReservedData.getReservedKeys({ page: {} }).sort(), []);
  t.deepEqual(ReservedData.getReservedKeys({ page: "" }).sort(), ["page"]);
  t.deepEqual(ReservedData.getReservedKeys({ page: { date: "", otherkey: "" } }).sort(), ["page.date"]);
  t.deepEqual(ReservedData.getReservedKeys({ page: { inputPath: "", otherkey: "" } }).sort(), ["page.inputPath"]);
  t.deepEqual(ReservedData.getReservedKeys({ page: { fileSlug: "", otherkey: "" } }).sort(), ["page.fileSlug"]);
  t.deepEqual(ReservedData.getReservedKeys({ page: { filePathStem: "", otherkey: "" } }).sort(), ["page.filePathStem"]);
  t.deepEqual(ReservedData.getReservedKeys({ page: { outputFileExtension: "", otherkey: "" } }).sort(), ["page.outputFileExtension"]);
  t.deepEqual(ReservedData.getReservedKeys({ page: { templateSyntax: "", otherkey: "" } }).sort(), ["page.templateSyntax"]);
  t.deepEqual(ReservedData.getReservedKeys({ page: { url: "", otherkey: "" } }).sort(), ["page.url"]);
  t.deepEqual(ReservedData.getReservedKeys({ page: { outputPath: "", otherkey: "" } }).sort(), ["page.outputPath"]);
  t.deepEqual(ReservedData.getReservedKeys({ page: { date: "", outputPath: "", otherkey: "" } }).sort(), ["page.date", "page.outputPath"]);
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

  await t.throwsAsync(() => elev.toJSON(), {
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

  await t.throwsAsync(() => elev.toJSON(), {
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

  await t.throwsAsync(() => elev.toJSON(), {
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

  await t.throwsAsync(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names: eleventy (source: ./test/stubs-freeze/eleventy/_data/eleventy.js). You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });
});
