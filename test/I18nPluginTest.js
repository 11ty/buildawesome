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

// #3023: `locale_url` with a hash and/or query string
async function getLocaleUrlResults(errorMode, links) {
  let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
    quietMode: true,
    config: function ($config) {
      $config.addPlugin(I18nPlugin, {
        defaultLanguage: "en",
        errorMode,
      });

      $config.addTemplate("en/index.njk", "");
      $config.addTemplate("es/index.njk", "");
      $config.addTemplate("en/about.njk", "");
      $config.addTemplate("es/about.njk", "");
      $config.addTemplate("non-lang.njk", "");
      $config.addTemplate("es/links.njk", links);
    },
  });

  await elev.initializeConfig();
  elev.setIsVerbose(false);
  elev.disableLogger();

  let results = await elev.toJSON();
  return getContentFor(results, "/es/links.njk");
}

for (let errorMode of ["strict", "allow-fallback", "never"]) {
  test(`locale_url keeps the hash and query string (errorMode: ${errorMode}), Issue #3023`, async (t) => {
    let content = await getLocaleUrlResults(
      errorMode,
      `{{ "/about/#team" | locale_url }}
{{ "/about#team" | locale_url }}
{{ "/en/about/#team" | locale_url }}
{{ "/about/?q=1" | locale_url }}
{{ "/about/?q=1#team" | locale_url }}
{{ "/about/#team?q=1" | locale_url }}
{{ "/#top" | locale_url }}
{{ "/about/#team" | locale_url("en") }}
{{ "#top" | locale_url }}
{{ "?q=1" | locale_url }}
{{ "/about/" | locale_url }}
{{ "/about" | locale_url }}`,
    );

    t.assert.strictEqual(
      content,
      `/es/about/#team
/es/about#team
/es/about/#team
/es/about/?q=1
/es/about/?q=1#team
/es/about/#team?q=1
/es/#top
/en/about/#team
#top
?q=1
/es/about/
/es/about`,
    );
  });
}

test("locale_url with a hash, non-localized target (errorMode: strict), Issue #3023", async (t) => {
  await t.assert.rejects(getLocaleUrlResults("strict", `{{ "/non-lang/#top" | locale_url }}`), (err) => {
    while (err.cause) {
      err = err.cause;
    }
    return /^Localized file for URL \/es\/non-lang\/ was not found in your project\. A non-localized version does exist/.test(
      err.message,
    );
  });
});

test("locale_url with a hash, non-localized target (errorMode: allow-fallback), Issue #3023", async (t) => {
  let content = await getLocaleUrlResults("allow-fallback", `{{ "/non-lang/#top" | locale_url }}`);
  t.assert.strictEqual(content, "/non-lang/#top");
});
