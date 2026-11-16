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

  t.assert.strictEqual(Comparator.isLangCode("zh-hant-tw"), true);
  t.assert.strictEqual(Comparator.isLangCode("es-419"), true);

  // Valid BCP 47 syntax, but not a real script, region or plain language (#3766, #3352)
  t.assert.strictEqual(Comparator.isLangCode("sv-feed"), false);
  t.assert.strictEqual(Comparator.isLangCode("en-sitemap"), false);
  t.assert.strictEqual(Comparator.isLangCode("om-meg"), false);
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

test("locale_url swaps a language code already in a nested URL (#2791)", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { defaultLanguage: "en" });
      for (let lang of ["en", "ro", "it"]) {
        $config.addTemplate(`${lang}/my-article.njk`, `{{ "/en/my-article/" | locale_url }}`);
      }
    },
  });

  let results = await elev.toJSON();
  for (let lang of ["en", "ro", "it"]) {
    t.assert.strictEqual(
      results.find((entry) => entry.url === `/${lang}/my-article/`).content,
      `/${lang}/my-article/`,
    );
  }
});

test("locale_url ignores file names that look like language codes (#3766)", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { defaultLanguage: "en", errorMode: "never" });
      for (let lang of ["en", "sv"]) {
        let prefix = lang === "en" ? "" : `/${lang}`;
        $config.addTemplate(`${lang}/index.njk`, `{{ "/site.webmanifest" | locale_url }}`);
        $config.addTemplate(`${lang}-manifest.njk`, "", { permalink: `${prefix}/site.webmanifest` });
        $config.addTemplate(`${lang}-feed.njk`, "", { permalink: `/${lang}/feed/feed.xml` });
      }
    },
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.find((entry) => entry.url === "/en/").content, "/site.webmanifest");
  t.assert.strictEqual(results.find((entry) => entry.url === "/sv/").content, "/sv/site.webmanifest");
});

test("Comparator.isLangCode with an explicit languages list", (t) => {
  t.assert.strictEqual(Comparator.isLangCode("en", ["en", "ca-valencia"]), true);
  t.assert.strictEqual(Comparator.isLangCode("ca-valencia", ["en", "ca-valencia"]), true);
  t.assert.strictEqual(Comparator.isLangCode("to-do", ["en", "ca-valencia"]), false);
  t.assert.strictEqual(Comparator.isLangCode("es", ["en", "ca-valencia"]), false);
});

test("languages option limits detected language codes", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { defaultLanguage: "en", languages: ["ca-valencia"] });
      $config.addTemplate("en/index.njk", "{{ page.lang }}");
      $config.addTemplate("ca-valencia/index.njk", `{{ page.lang }} {{ "/" | locale_url }}`);
      $config.addTemplate("to-do.njk", "{{ page.lang }}");
    },
  });

  let results = await elev.toJSON();
  let getContent = (url) => results.find((entry) => entry.url === url).content;
  t.assert.strictEqual(getContent("/en/"), "en");
  t.assert.strictEqual(getContent("/ca-valencia/"), "ca-valencia /ca-valencia/");
  t.assert.strictEqual(getContent("/to-do/"), "en");
});

test("languages option must be an array", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { defaultLanguage: "en", languages: "en,es" });
    },
  });
  elev.disableLogger();
  await t.assert.rejects(() => elev.toJSON(), (error) => /must be an array/.test(error.cause?.message));
});

test("languages option sets defaultLanguage to its first entry when missing", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { languages: ["es", "en"] });
      $config.addTemplate("about.njk", "{{ page.lang }}");
    },
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results[0].content, "es");
});

test("getPreviousCollectionItem and getNextCollectionItem skip translations when the collection has every language (#3207)", async (t) => {
  let content = `{% assign p = collections.posts | getPreviousCollectionItem %}{% assign n = collections.posts | getNextCollectionItem %}{{ p.url | default: "NONE" }},{{ n.url | default: "NONE" }}`;

  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { defaultLanguage: "en", languages: ["en", "es"] });

      for (let lang of ["en", "es"]) {
        $config.addTemplate(`${lang}/posts/first.liquid`, content, {
          tags: "posts",
          date: "2024-01-01",
        });
        $config.addTemplate(`${lang}/posts/second.liquid`, content, {
          tags: "posts",
          date: "2024-01-02",
        });
      }
    },
  });

  let results = await elev.toJSON();
  let getContent = (url) => results.find((entry) => entry.url === url).content;

  t.assert.strictEqual(getContent("/en/posts/first/"), "NONE,/en/posts/second/");
  t.assert.strictEqual(getContent("/en/posts/second/"), "/en/posts/first/,NONE");
  t.assert.strictEqual(getContent("/es/posts/first/"), "NONE,/es/posts/second/");
  t.assert.strictEqual(getContent("/es/posts/second/"), "/es/posts/first/,NONE");
});

test("getCollectionItemIndex is relative to the default language pages (#3207)", async (t) => {
  let content = `{{ collections.posts | getCollectionItemIndex }}`;

  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { defaultLanguage: "en", languages: ["en", "es"] });

      for (let lang of ["en", "es"]) {
        $config.addTemplate(`${lang}/posts/first.liquid`, content, {
          tags: "posts",
          date: "2024-01-01",
        });
        $config.addTemplate(`${lang}/posts/second.liquid`, content, {
          tags: "posts",
          date: "2024-01-02",
        });
      }
    },
  });

  let results = await elev.toJSON();
  let getContent = (url) => results.find((entry) => entry.url === url).content;

  t.assert.strictEqual(getContent("/en/posts/first/"), "0");
  t.assert.strictEqual(getContent("/es/posts/first/"), "0");
  t.assert.strictEqual(getContent("/en/posts/second/"), "1");
  t.assert.strictEqual(getContent("/es/posts/second/"), "1");
});

for (let [ext, content, setup] of [
  [
    "liquid",
    `{% assign p = collections.posts | getPreviousCollectionItem: page, "es" %}{% assign n = collections.posts | getNextCollectionItem: page, "es" %}{{ p.url | default: "NONE" }},{{ n.url | default: "NONE" }}`,
  ],
  [
    "njk",
    `{% set p = collections.posts | getPreviousCollectionItem(page, "es") %}{% set n = collections.posts | getNextCollectionItem(page, "es") %}{{ p.url if p else "NONE" }},{{ n.url if n else "NONE" }}`,
  ],
  [
    "11ty.js",
    function (data) {
      let p = this.getPreviousCollectionItem(data.collections.posts, data.page, "es");
      let n = this.getNextCollectionItem(data.collections.posts, data.page, "es");
      return `${p?.url || "NONE"},${n?.url || "NONE"}`;
    },
  ],
  [
    "custom",
    "",
    ($config) => {
      $config.addTemplateFormats("custom");
      $config.addExtension("custom", {
        compile: () => (data) => {
          let previous = $config.augmentFunctionContext($config.getFilter("getPreviousCollectionItem"), { source: data });
          let next = $config.augmentFunctionContext($config.getFilter("getNextCollectionItem"), { source: data });
          let p = previous(data.collections.posts, data.page, "es");
          let n = next(data.collections.posts, data.page, "es");
          return `${p?.url || "NONE"},${n?.url || "NONE"}`;
        },
      });
    },
  ],
]) {
  test(`getPreviousCollectionItem and getNextCollectionItem resolve a localized item from collections.all (${ext})`, async (t) => {
    let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
      config: function ($config) {
        $config.addPlugin(I18nPlugin, { defaultLanguage: "en", languages: ["en", "es"] });
        setup?.($config);

        for (let lang of ["en", "es"]) {
          for (let [slug, date] of [["first", "2024-01-01"], ["second", "2024-01-02"], ["third", "2024-01-03"]]) {
            $config.addTemplate(`${lang}/posts/${slug}.${ext}`, content, { tags: "posts", date });
          }
        }
      },
    });

    let results = await elev.toJSON();
    let getContent = (url) => results.find((entry) => entry.url === url).content;

    t.assert.strictEqual(getContent("/en/posts/first/"), "NONE,/es/posts/second/");
    t.assert.strictEqual(getContent("/en/posts/second/"), "/es/posts/first/,/es/posts/third/");
    t.assert.strictEqual(getContent("/es/posts/third/"), "/es/posts/second/,NONE");
  });
}

test("locale_links and locale_url match paginated pages by URL", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { defaultLanguage: "en", errorMode: "never" });
      let content = `{% for link in page.url | locale_links %}{{ link.url }} {% endfor %}|{{ "/en/story/gamma/" | locale_url }}`;
      let stories = { en: ["alpha", "beta", "gamma"], fr: ["alpha", "gamma"] };
      for (let lang in stories) {
        $config.addTemplate(`${lang}/story.njk`, content, {
          pagination: { data: "stories", size: 1, alias: "story" },
          stories: stories[lang],
          permalink: `/${lang}/story/{{ story }}/`,
        });
      }
    },
  });

  let results = await elev.toJSON();
  let content = (url) => results.find((entry) => entry.url === url).content;
  t.assert.strictEqual(content("/en/story/alpha/"), "/fr/story/alpha/ |/en/story/gamma/");
  t.assert.strictEqual(content("/en/story/beta/"), "|/en/story/gamma/");
  t.assert.strictEqual(content("/fr/story/alpha/"), "/en/story/alpha/ |/fr/story/gamma/");
  t.assert.strictEqual(content("/fr/story/gamma/"), "/en/story/gamma/ |/fr/story/gamma/");
});

test("locale_links matches paginated pages when the default language has no URL prefix", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { defaultLanguage: "en" });
      for (let lang of ["en", "de", "es"]) {
        let prefix = lang === "en" ? "" : `/${lang}`;
        // es has no matching translations
        let permalink = lang === "es" ? "/es/noticias/{{ pagination.pageNumber }}/" : `${prefix}/blog/{{ pagination.pageNumber }}/`;
        $config.addTemplate(`${lang}/blog.njk`, `{% for link in page.url | locale_links %}{{ link.url }} {% endfor %}`, {
          pagination: { data: "posts", size: 1 },
          posts: [1, 2],
          permalink,
        });
      }
    },
  });

  let results = await elev.toJSON();
  let content = (url) => results.find((entry) => entry.url === url).content;
  t.assert.strictEqual(content("/blog/1/"), "/de/blog/1/ ");
  t.assert.strictEqual(content("/de/blog/0/"), "/blog/0/ ");
  t.assert.strictEqual(content("/es/noticias/0/"), "");
});

test("buildawesomeTranslationKey groups paginated translations with different URLs", async (t) => {
  let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
    config: function ($config) {
      $config.addPlugin(I18nPlugin, { defaultLanguage: "en" });
      $config.addGlobalData("tagTranslations", [
        { buildawesomeTranslationKey: "wood", en: "wood", de: "holz" },
        // Legacy name
        { eleventyPaginationGroupNumber: "metal", en: "metal", de: "metall" },
      ]);
      for (let lang of ["en", "de"]) {
        $config.addTemplate(
          `${lang}/tags.njk`,
          `{% for link in page.url | locale_links %}{{ link.url }} {% endfor %}|{{ "/en/tags/wood/" | locale_url }}`,
          {
            pagination: { data: "tagTranslations", size: 1, alias: "tag" },
            permalink: `/${lang}/tags/{{ tag.${lang} }}/`,
          },
        );
      }
    },
  });

  let results = await elev.toJSON();
  let content = (url) => results.find((entry) => entry.url === url).content;
  t.assert.strictEqual(content("/en/tags/wood/"), "/de/tags/holz/ |/en/tags/wood/");
  t.assert.strictEqual(content("/de/tags/holz/"), "/en/tags/wood/ |/de/tags/holz/");
  t.assert.strictEqual(content("/de/tags/metall/"), "/en/tags/metal/ |/de/tags/holz/");
});
