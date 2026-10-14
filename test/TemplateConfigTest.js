import test from "ava";
import md from "markdown-it";

import TemplateConfig from "../src/TemplateConfig.js";
import defaultConfig from "../src/defaultConfig.js";

import { getTemplateConfigInstance } from "./_testHelpers.js";

test("Template Config local config overrides base config", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  await templateCfg.init();

  let cfg = templateCfg.getConfig();

  t.is(cfg.markdownTemplateEngine, "njk");
  t.is(cfg.templateFormats.join(","), "md,njk");

  // merged, not overwritten
  t.true(Object.keys(cfg.keys).length > 1);
  t.truthy(Object.keys(cfg.nunjucksFilters).length);

  t.is(Object.keys(cfg.transforms).length, 4);

  t.is(
    cfg.transforms.prettyHtml(`<html><body><div></div></body></html>`, "test.html"),
    `<html>
  <body>
    <div></div>
  </body>
</html>`,
  );
});

test("Add liquid tag", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addLiquidTag("myTagName", function () {});

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidTags).indexOf("myTagName"), -1);
});

test("Add nunjucks tag", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addNunjucksTag("myNunjucksTag", function () {});

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksTags).indexOf("myNunjucksTag"), -1);
});

test("Add nunjucks global", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addNunjucksGlobal("myNunjucksGlobal1", function () {});
  templateCfg.userConfig.addNunjucksGlobal("myNunjucksGlobal2", 42);

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksGlobals).indexOf("myNunjucksGlobal1"), -1);
  t.not(Object.keys(cfg.nunjucksGlobals).indexOf("myNunjucksGlobal2"), -1);
});

test("Add liquid filter", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addLiquidFilter("myFilterName", function (liquidEngine) {
    return {};
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("myFilterName"), -1);
});

test("Add nunjucks filter", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addNunjucksFilter("myFilterName", function () {});

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test("Add universal filter", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addFilter("myFilterName", function () {});

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("myFilterName"), -1);
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test("Add namespaced universal filter", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.namespace("testNamespace", function () {
    templateCfg.userConfig.addFilter("MyFilterName", function () {});
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("testNamespaceMyFilterName"), -1);
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("testNamespaceMyFilterName"), -1);
});

test("Add namespaced universal filter using underscore", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.namespace("testNamespace_", function () {
    templateCfg.userConfig.addFilter("myFilterName", function () {});
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("testNamespace_myFilterName"), -1);
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("testNamespace_myFilterName"), -1);
});

test("Add namespaced plugin", async (t) => {
  let templateCfg = new TemplateConfig();

  templateCfg.userConfig.namespace("testNamespace", function () {
    templateCfg.userConfig.addPlugin(function ($config) {
      $config.addFilter("MyFilterName", function () {});
    });
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("testNamespaceMyFilterName"), -1);
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("testNamespaceMyFilterName"), -1);
});

test("Add namespaced plugin using underscore", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.namespace("testNamespace_", function () {
    templateCfg.userConfig.addPlugin(function (config) {
      config.addFilter("myFilterName", function () {});
    });
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("testNamespace_myFilterName"), -1);
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("testNamespace_myFilterName"), -1);
});

test("Empty namespace", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.namespace("", function () {
    templateCfg.userConfig.addNunjucksFilter("myFilterName", function () {});
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test("Nested Empty Inner namespace", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");

  templateCfg.userConfig.namespace("testNs", function () {
    templateCfg.userConfig.namespace("", function () {
      templateCfg.userConfig.addNunjucksFilter("myFilterName", function () {});
    });
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("testNsmyFilterName"), -1);
});

test("Nested Empty Outer namespace", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.namespace("", function () {
    templateCfg.userConfig.namespace("testNs", function () {
      templateCfg.userConfig.addNunjucksFilter("myFilterName", function () {});
    });
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("testNsmyFilterName"), -1);
});

// important for backwards compatibility with old
// `module.exports = function ($config, pluginNamespace) {`
// plugin code
test("Non-string namespaces are ignored", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.namespace(["lkdsjflksd"], function () {
    templateCfg.userConfig.addNunjucksFilter("myFilterName", function () {});
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test(".addPlugin oddity: I don’t think pluginNamespace was ever passed in here, but we don’t want this to break", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");

  templateCfg.userConfig.addPlugin(function ($config, pluginNamespace) {
    $config.namespace(pluginNamespace, () => {
      $config.addNunjucksFilter("myFilterName", function () {});
    });
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test("Test url universal filter with custom pathPrefix (no slash)", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.setPathPrefix("/testdirectory/");

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.is(cfg.pathPrefix, "/testdirectory/");
});

test("setTemplateFormats(string)", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  // 0.11.0 removes dupes
  templateCfg.userConfig.setTemplateFormats("njk, liquid, njk");

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["njk", "liquid"]);
});

test("setTemplateFormats(array)", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.setTemplateFormats(["njk", "liquid"]);

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["njk", "liquid"]);
});

test("setTemplateFormats(array, size 1)", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.setTemplateFormats(["liquid"]);

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["liquid"]);
});

test("setTemplateFormats(empty array)", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.setTemplateFormats([]);

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, []);
});

test("setTemplateFormats(null)", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.setTemplateFormats(null);

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual([...cfg.templateFormats].sort(), ["md", "njk"]);
});

test("setTemplateFormats(undefined)", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.setTemplateFormats(undefined);

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual([...cfg.templateFormats].sort(), ["md", "njk"]);
});

test("multiple setTemplateFormats calls", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.setTemplateFormats("njk");
  templateCfg.userConfig.setTemplateFormats("pug");

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["pug"]);
});

test("addTemplateFormats()", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addTemplateFormats("vue");
  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  // should have ALL of the original defaults
  t.deepEqual(cfg.templateFormats, ["md", "njk", "vue"]);
});

test("addTemplateFormats() via Plugin", async (t) => {
  let templateCfg = new TemplateConfig();
  templateCfg.userConfig.addTemplateFormats("pug");
  templateCfg.userConfig.addPlugin(cfg => {
    cfg.addTemplateFormats("webc");
  });
  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["liquid", "md", "njk", "html", "11ty.js", "pug", "webc"]);
});


test("both setTemplateFormats and addTemplateFormats", async (t) => {
  // Template Formats can come from three places
  // defaultConfig.js config API (not used yet)
  // defaultConfig.js config return object
  // project config file config API
  // project config file config return object

  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addTemplateFormats("vue");
  templateCfg.userConfig.setTemplateFormats("pug");
  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["pug", "vue"]);
});

test("addTemplateFormats() Array", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addTemplateFormats("vue2");
  templateCfg.userConfig.addTemplateFormats(["vue"]);
  templateCfg.userConfig.addTemplateFormats(["text", "txt"]);
  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  // should have ALL of the original defaults
  t.deepEqual(cfg.templateFormats, ["md", "njk", "vue2", "vue", "text", "txt"]);
});

test("libraryOverrides", async (t) => {
  let mdLib = md();
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.setLibrary("md", mdLib);
  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.falsy(cfg.libraryOverrides.ldkja);
  t.falsy(cfg.libraryOverrides.njk);
  t.truthy(cfg.libraryOverrides.md);
  t.deepEqual(mdLib, cfg.libraryOverrides.md);
});

test("addGlobalData", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addGlobalData("function", () => new Date());

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.globalData).indexOf("function"), -1);
});

test("Properly throws error on missing module #182", async (t) => {
  await t.throwsAsync(async () => {
    let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/broken-config.cjs");

    await templateCfg.init();

    templateCfg.getConfig();
  });
});

test("Properly throws error when config returns a Promise", async (t) => {
  await t.throwsAsync(async () => {
    let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config-promise.js");
    await templateCfg.init();

    templateCfg.getConfig();
  });
});

test(".addWatchTarget adds a watch target", async (t) => {
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config.cjs");
  templateCfg.userConfig.addWatchTarget("/testdirectory/");

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.additionalWatchTargets, ["/testdirectory/"]);
});

test("Nested .addPlugin calls", async (t) => {
  t.plan(2);
  let templateCfg = new TemplateConfig();

  templateCfg.userConfig.addPlugin(function OuterPlugin($config) {
    t.truthy(true);

    $config.addPlugin(function InnerPlugin($config) {
      t.truthy(true);
    });
  });

  await templateCfg.init();

  templateCfg.getConfig();
});

test("Nested .addPlugin calls (×3)", async (t) => {
  t.plan(3);
  let templateCfg = new TemplateConfig();

  templateCfg.userConfig.addPlugin(function OuterPlugin($config) {
    t.truthy(true);

    $config.addPlugin(function InnerPlugin($config) {
      t.truthy(true);

      $config.addPlugin(function InnerPlugin($config) {
        t.truthy(true);
      });
    });
  });

  await templateCfg.init();

  templateCfg.getConfig();
});

test("Nested .addPlugin calls order", async (t) => {
  t.plan(3);
  let templateCfg = new TemplateConfig();
  let order = [];

  templateCfg.userConfig.addPlugin(function OuterPlugin($config) {
    order.push(1);
    t.deepEqual(order, [1]);

    $config.addPlugin(function InnerPlugin($config) {
      order.push(2);
      t.deepEqual(order, [1, 2]);

      $config.addPlugin(function InnerPlugin($config) {
        order.push(3);
        t.deepEqual(order, [1, 2, 3]);
      });
    });
  });

  await templateCfg.init();

  templateCfg.getConfig();
});

test("Nested .addPlugin calls. More complex order", async (t) => {
  t.plan(5);
  let templateCfg = new TemplateConfig();
  let order = [];

  templateCfg.userConfig.addPlugin(function OuterPlugin($config) {
    order.push("1");
    t.deepEqual(order, ["1"]);

    $config.addPlugin(function InnerPlugin($config) {
      order.push("2");
      t.deepEqual(order, ["1", "2"]);

      $config.addPlugin(function InnerPlugin($config) {
        order.push("3a");
        t.deepEqual(order, ["1", "2", "3a"]);
      });

      $config.addPlugin(function InnerPlugin($config) {
        order.push("3b");
        t.deepEqual(order, ["1", "2", "3a", "3b"]);
      });
    });

    $config.addPlugin(function InnerPlugin($config) {
      order.push("2b");
      t.deepEqual(order, ["1", "2", "3a", "3b", "2b"]);
    });
  });

  await templateCfg.init();

  templateCfg.getConfig();
});

test(".addPlugin has access to pathPrefix", async (t) => {
  t.plan(1);
  let templateCfg = new TemplateConfig();

  templateCfg.userConfig.addPlugin(function ($config) {
    t.is($config.pathPrefix, "/");
  });

  await templateCfg.init();

  templateCfg.getConfig();
});

test(".addPlugin has access to pathPrefix (override method)", async (t) => {
  t.plan(1);
  let templateCfg = new TemplateConfig();
  templateCfg.setPathPrefix("/test/");

  templateCfg.userConfig.addPlugin(function ($config) {
    t.is($config.pathPrefix, "/test/");
  });

  await templateCfg.init();

  templateCfg.getConfig();
});

test("falsy pathPrefix should fall back to default", async (t) => {
  t.plan(1);
  let templateCfg = new TemplateConfig(defaultConfig, "./test/stubs/config-empty-pathprefix.cjs");

  templateCfg.userConfig.addPlugin(function ($config) {
    t.is($config.pathPrefix, "/");
  });

  await templateCfg.init();

  templateCfg.getConfig();
});

test("Add async plugin", async (t) => {
  let templateCfg = new TemplateConfig();

  await templateCfg.userConfig.addPlugin(async ($config) => {
    await new Promise((resolve) => {
      setTimeout(() => {
        $config.addFilter("myFilterName", function () {});
        resolve();
      }, 10);
    });
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("myFilterName"), -1);
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test("Async namespace", async (t) => {
  let templateCfg = new TemplateConfig();

  await templateCfg.userConfig.namespace("testNamespace", async ($config) => {
    await new Promise((resolve) => {
      setTimeout(() => {
        $config.addFilter("MyFilterName", function () {});
        resolve();
      }, 10);
    });
  });

  await templateCfg.init();

  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("testNamespaceMyFilterName"), -1);
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("testNamespaceMyFilterName"), -1);
});

test("ProjectDirectories instance exists in user accessible config", async (t) => {
	let $config = await getTemplateConfigInstance();
  let cfg = $config.getConfig();

  t.truthy(cfg.directories);
  t.is(cfg.directories.input, "./");
  t.is(cfg.directories.data, "./_data/");
  t.is(cfg.directories.includes, "./_includes/");
  t.is(cfg.directories.layouts, undefined);
  t.is(cfg.directories.output, "./_site/");

	t.throws(() => {
		cfg.directories.input = "should not work";
	});
	t.throws(() => {
		cfg.directories.data = "should not work";
	});
	t.throws(() => {
		cfg.directories.includes = "should not work";
	});
	t.throws(() => {
		cfg.directories.layouts = "should not work";
	});
	t.throws(() => {
		cfg.directories.output = "should not work";
	});
});

test("Test getters #3310", async (t) => {
  let templateCfg = new TemplateConfig();
  let userCfg = templateCfg.userConfig;

  userCfg.addShortcode("myShortcode", function () {});
  userCfg.addShortcode("myAsyncShortcode", async function () {});

  userCfg.addPairedShortcode("myPairedShortcode", function () {});
  userCfg.addPairedShortcode("myPairedAsyncShortcode", async function () {});

  userCfg.addFilter("myFilter", function () {});
  userCfg.addFilter("myAsyncFilter", async function () {});
  userCfg.addPlugin(function ($config) {
    $config.addFilter("myPluginFilter", function () {});
  });

  await templateCfg.init();

  let filterNames = Object.keys(userCfg.getFilters());
  t.true(filterNames.includes("myFilter"));
  t.true(filterNames.includes("myAsyncFilter"));
  t.true(filterNames.includes("myPluginFilter"));

  let filterNamesSync = Object.keys(userCfg.getFilters({ type: "sync" }));
  t.true(filterNamesSync.includes("myFilter"));
  t.false(filterNamesSync.includes("myAsyncFilter"));
  t.true(filterNamesSync.includes("myPluginFilter"));

  let filterNamesAsync = Object.keys(userCfg.getFilters({ type: "async" }));
  t.false(filterNamesAsync.includes("myFilter"));
  t.true(filterNamesAsync.includes("myAsyncFilter"));
  t.false(filterNamesAsync.includes("myPluginFilter"));

  t.truthy(userCfg.getFilter("myFilter"));
  t.truthy(userCfg.getFilter("myAsyncFilter"));
  t.truthy(userCfg.getFilter("myPluginFilter"));

  let shortcodeNames = Object.keys(userCfg.getShortcodes());
  t.true(shortcodeNames.includes("myShortcode"));
  t.true(shortcodeNames.includes("myAsyncShortcode"));

  let shortcodeNamesSync = Object.keys(userCfg.getShortcodes({ type: "sync" }));
  t.true(shortcodeNamesSync.includes("myShortcode"));
  t.false(shortcodeNamesSync.includes("myAsyncShortcode"));

  let shortcodeNamesAsync = Object.keys(userCfg.getShortcodes({ type: "async" }));
  t.false(shortcodeNamesAsync.includes("myShortcode"));
  t.true(shortcodeNamesAsync.includes("myAsyncShortcode"));

  t.truthy(userCfg.getShortcode("myShortcode"));
  t.truthy(userCfg.getShortcode("myAsyncShortcode"));

  let pairedShortcodeNames = Object.keys(userCfg.getPairedShortcodes());
  t.true(pairedShortcodeNames.includes("myPairedShortcode"));
  t.true(pairedShortcodeNames.includes("myPairedAsyncShortcode"));

  let pairedShortcodeNamesSync = Object.keys(userCfg.getPairedShortcodes({ type: "sync" }));
  t.true(pairedShortcodeNamesSync.includes("myPairedShortcode"));
  t.false(pairedShortcodeNamesSync.includes("myPairedAsyncShortcode"));

  let pairedShortcodeNamesAsync = Object.keys(userCfg.getPairedShortcodes({ type: "async" }));
  t.false(pairedShortcodeNamesAsync.includes("myPairedShortcode"));
  t.true(pairedShortcodeNamesAsync.includes("myPairedAsyncShortcode"));

  t.truthy(userCfg.getPairedShortcode("myPairedShortcode"));
  t.truthy(userCfg.getPairedShortcode("myPairedAsyncShortcode"));
});
