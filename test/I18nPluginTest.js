import test from "node:test";
import { Comparator, LangUtils, default as I18nPlugin } from "../src/Plugins/I18nPlugin.js";
import Eleventy from "../src/Core.js";
import { normalizeNewLines } from "./Util/normalizeNewLines.js";

test("Comparator.isLangCode", (t) => {
  t.assert.strictEqual(Comparator.isLangCode(null), false);
  t.assert.strictEqual(Comparator.isLangCode(undefined), false);

  t.assert.strictEqual(Comparator.isLangCode("en"), true);
  t.assert.strictEqual(Comparator.isLangCode("en-us"), true);

  t.assert.strictEqual(Comparator.isLangCode("dee"), false);
  t.assert.strictEqual(Comparator.isLangCode("en_us"), false);
  t.assert.strictEqual(Comparator.isLangCode("d"), false);
  t.assert.strictEqual(Comparator.isLangCode("deed"), false);
  t.assert.strictEqual(Comparator.isLangCode("deede"), false);
  t.assert.strictEqual(Comparator.isLangCode("deedee"), false);
});

test("LangUtils.swapLanguageCode", (t) => {
  t.assert.strictEqual(LangUtils.swapLanguageCode("/"), "/"); // skip
  t.assert.strictEqual(LangUtils.swapLanguageCode("/", "en"), "/"); // skip
  t.assert.strictEqual(LangUtils.swapLanguageCode("/es/", "en"), "/en/");
  t.assert.strictEqual(LangUtils.swapLanguageCode("/es/", "not"), "/es/"); // skip
  t.assert.strictEqual(LangUtils.swapLanguageCode("/not-a-lang/", "en"), "/not-a-lang/"); // skip
  t.assert.strictEqual(LangUtils.swapLanguageCode("/es/es/es/", "en"), "/en/es/es/"); // first only
});

test("contentMap Event from Eleventy", async (t) => {
  t.plan(4);
  let elev = new Eleventy("./test/stubs-i18n/", "./test/stubs-i18n/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, {
        defaultLanguage: "en",
        errorMode: "allow-fallback",
      });

      $config.on("buildawesome.contentmap", (maps) => {
        t.assert.ok(maps);

        // if future maps are added, they should be tested here
        t.assert.strictEqual(Object.keys(maps).length, 2);
        t.assert.deepStrictEqual(maps.urlToInputPath, {
          "/en/": {
						inputPath: "./test/stubs-i18n/en/index.liquid",
						groupNumber: 0
					},
          "/en-us/": {
						inputPath: "./test/stubs-i18n/en-us/index.11ty.cjs",
						groupNumber: 0,
					},
          "/es/": {
						inputPath: "./test/stubs-i18n/es/index.njk",
						groupNumber: 0
					},
          "/non-lang-file/": {
						inputPath: "./test/stubs-i18n/non-lang-file.njk",
						groupNumber: 0
					},
        });

        t.assert.deepStrictEqual(maps.inputPathToUrl, {
          "./test/stubs-i18n/en/index.liquid": ["/en/"],
          "./test/stubs-i18n/en-us/index.11ty.cjs": ["/en-us/"],
          "./test/stubs-i18n/es/index.njk": ["/es/"],
          "./test/stubs-i18n/non-lang-file.njk": ["/non-lang-file/"],
        });
      });
    },
  });

  await elev.toJSON();
});

function getContentFor(results, filename) {
  let content = results.filter((entry) => entry.inputPath.endsWith(filename))[0].content;
  return normalizeNewLines(content.trim());
}

test("errorMode default (strict)", async (t) => {
  let elev = new Eleventy("./test/stubs-i18n/", "./test/stubs-i18n/_site", {
    quietMode: true,
    config: function ($config) {
      $config.addPlugin(I18nPlugin, {
        _test: "this is from errorMode default (strict)",
        defaultLanguage: "en",
        // errorMode: "allow-fallback"
      });
    },
  });

  // TODO get rid of these?
  await elev.initializeConfig();
  elev.setIsVerbose(false);
  elev.disableLogger();

  await t.assert.rejects(async () => {
    await elev.toJSON();
  });
});

test("locale_url and locale_links Filters", async (t) => {
  let elev = new Eleventy("./test/stubs-i18n/", "./test/stubs-i18n/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, {
        _test: "this is from locale_url and locale_links Filters",
        defaultLanguage: "en",
        errorMode: "allow-fallback",
      });
    },
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(
    getContentFor(results, "/non-lang-file.njk"),
    `/en/
/en-us/
/non-lang-file/
[]
[]
en`
  );

  t.assert.strictEqual(
    getContentFor(results, "/es/index.njk"),
    `/es/
/es/
/es/
/en-us/
/non-lang-file/
[{"url":"/en/","lang":"en","label":"English"},{"url":"/en-us/","lang":"en-us","label":"English"}]
[{"url":"/en/","lang":"en","label":"English"},{"url":"/en-us/","lang":"en-us","label":"English"}]
es`
  );

  t.assert.strictEqual(
    getContentFor(results, "/en/index.liquid"),
    `/en/
/en/
/en/
/en-us/
/non-lang-file/
[{"url":"/en-us/","lang":"en-us","label":"English"},{"url":"/es/","lang":"es","label":"Español"}]
[{"url":"/en-us/","lang":"en-us","label":"English"},{"url":"/es/","lang":"es","label":"Español"}]
en`
  );

  t.assert.strictEqual(
    getContentFor(results, "/en-us/index.11ty.cjs"),
    `/en-us/
/en-us/
/en-us/
/es/
/non-lang-file/
[{"url":"/en/","lang":"en","label":"English"},{"url":"/es/","lang":"es","label":"Español"}]
[{"url":"/en/","lang":"en","label":"English"},{"url":"/es/","lang":"es","label":"Español"}]
en-us`
  );
});
