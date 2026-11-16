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


for (let errorMode of ["strict", "allow-fallback", "never"]) {
  test(`locale_url preserves fragments (${errorMode})`, async (t) => {
    let urls = [
      "/#heading",
      "/en/#heading",
      "/en#heading",
      "/#",
      "/#heading%20one#two",
      "/?a=1",
      "/en?a=1#heading",
    ];
    let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
      config: function (config) {
        config.addPlugin(I18nPlugin, { defaultLanguage: "en", errorMode });
        let template = urls.map((url) => `{{ "${url}" | locale_url }}`).join("\n");
        template += '\n{{ "/#heading" | locale_url("en-us") }}';
        for (let lang of ["en", "es", "en-us"]) {
          config.addTemplate(`${lang}/index.njk`, template);
        }
        config.addTemplate("index.njk", '{{ "/#heading" | locale_url }}');
      },
    });

    let results = await elev.toJSON();
    for (let lang of ["en", "es", "en-us"]) {
      t.assert.strictEqual(
        results.find((entry) => entry.url === `/${lang}/`).content,
        `/${lang}/#heading\n/${lang}/#heading\n/${lang}/#heading\n/${lang}/\n/${lang}/#heading%20one#two\n/${lang}/?a=1\n/${lang}/?a=1#heading\n/en-us/#heading`,
      );
    }
    t.assert.strictEqual(results.find((entry) => entry.url === "/").content, "/en/#heading");
  });
}

for (let errorMode of ["allow-fallback", "never"]) {
  test(`locale_url preserves fragments on a non-localized fallback (${errorMode})`, async (t) => {
    let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
      config: function (config) {
        config.addPlugin(I18nPlugin, { defaultLanguage: "en", errorMode });
        config.addTemplate("shared.njk", "Shared page");
        config.addTemplate("es/index.njk", '{{ "/shared/#heading" | locale_url }}\n{{ "/shared/?a=1" | locale_url }}');
      },
    });

    let results = await elev.toJSON();
    t.assert.strictEqual(
      results.find((entry) => entry.url === "/es/").content,
      "/shared/#heading\n/shared/?a=1",
    );
  });
}

test("locale_url still rejects a non-localized fallback with a fragment in strict mode", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function (config) {
      config.addPlugin(I18nPlugin, { defaultLanguage: "en" });
      config.addTemplate("shared.njk", "Shared page");
      config.addTemplate("es/index.njk", '{{ "/shared/#heading" | locale_url }}');
    },
  });
  elev.disableLogger();
  await t.assert.rejects(() => elev.toJSON());
});

test("locale_url leaves fragment-only and external links unchanged", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function (config) {
      config.addPlugin(I18nPlugin, { defaultLanguage: "en", errorMode: "never" });
      config.addTemplate(
        "es/index.njk",
        '{{ "#heading" | locale_url }}\n{{ "https://example.com/#heading" | locale_url }}',
      );
    },
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results[0].content, "#heading\nhttps://example.com/#heading");
});
