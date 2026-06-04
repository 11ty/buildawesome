import test from "ava";
import fs from "node:fs";

import {
  default as RenderPlugin,
  File as RenderPluginFile,
  String as RenderPluginString,
  RenderManager,
} from "../src/Plugins/RenderPlugin.js";
import Eleventy from "../src/Eleventy.js";
import TemplateConfig from "../src/TemplateConfig.js";
import ProjectDirectories from "../src/Util/ProjectDirectories.js";

import { normalizeNewLines } from "./Util/normalizeNewLines.js";


async function getTestOutput(input, configCallback = function () {}) {
  let elev = new Eleventy(input, "./_site/", {
    config: function (eleventyConfig) {
      eleventyConfig.addPlugin(RenderPlugin);
      configCallback(eleventyConfig);
    },
  });

  elev.setIsVerbose(false);

  // Careful with this!
  // elev.disableLogger();

  let result = await elev.toJSON();

  if (!result.length) {
    throw new Error(`No Eleventy JSON output found for input: ${input}`);
  }
  return result;
}

async function getTestOutputForFile(inputFile, configCallback) {
  let result = await getTestOutput(inputFile, configCallback);
  let html = normalizeNewLines(result[0].content.trim());
  return html;
}

test("Use liquid in nunjucks", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid.njk");
  t.is(
    html,
    `nunjucksHi
69


* liquidHi test test liquidBye 138`
  );
});

test("Use liquid+markdown in 11ty.js", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-md.11ty.cjs");
  t.is(
    html,
    `<h1>Markdown</h1>
<ul>
<li>2</li>
</ul>`
  );
});

test("Use nunjucks in 11ty.js", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/nunjucks.11ty.cjs");
  t.is(html, `* iHtpircsavaj`);
});

// This is not yet supported and currently throws an error.
test.skip("Use 11ty.js in liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/11tyjs.liquid");
  t.is(html, `TESTING`);
});

test("Use nunjucks in liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/nunjucks.liquid");
  t.is(
    html,
    `* iHdiuqil
* lfjksdlba`
  );
});

test("Use markdown in liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/md.liquid");
  t.is(
    html,
    `<h1>Hello {{ hi }}</h1>
<ul>
<li>Testing</li>
</ul>`
  );
});

test("Use nunjucks file in njk (uses renderTemplate inside of the nunjucks file)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/njk-file.njk");
  t.is(
    html,
    `TESTING

TESTING IN LIQUID

* 999`
  );
});

test("Use 11ty.js file in njk", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/11tyjs-file.njk");
  t.is(html, `TESTING`);
});

// 3.0 breaking change, we can’t alias to 11ty.js any more
test.skip("Breaking Change (3.0): Use txt file in njk (override to 11ty.js)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/11tyjs-file-override.njk");
  t.is(html, `TESTING`);
});

// Skip this for now, toJSON calls actually change the exitCode of the process when they error,
// which is not ideal.
test.skip("Use nunjucks file in liquid but it doesn’t exist", async (t) => {
  await t.throwsAsync(async () => {
    await getTestOutputForFile("./test/stubs-render-plugin/njk-file-not-exist.liquid");
  });
});

test("No syntax passed, uses parent page syntax: liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/false.liquid");
  t.is(
    html,
    `# Hello Bruno
* Testing`
  );
});

test("No syntax passed (uses parent page syntax), but does pass data: liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/data-no-templatelang.liquid");
  t.is(
    html,
    `# Hello Bruno
* Testing`
  );
});

// Not yet supported
test.skip("renderFile but the target has front matter.", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/using-frontmatter.liquid");
  t.is(html, `frontmatterString`);
});

// Idea from https://twitter.com/raymondcamden/status/1460961620247650312
test("Capture nunjucks render output to a liquid variable", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/capture-njk.liquid");
  t.is(html, `4`);
});

// Idea from https://twitter.com/raymondcamden/status/1460961620247650312
// Possibly blocked by async in {% set %} https://github.com/mozilla/nunjucks/issues/815
test("Capture liquid render output to a njk variable", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/capture-liquid.njk");
  t.is(html, `4`);
});

test("Remap non-object data to data._ if object is not passed in", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/bad-data.njk");
  t.is(html, "string");
});

test("Direct use of render string plugin, rendering Nunjucks (and nested Liquid)", async (t) => {
  let renderMgr = new RenderManager();
  renderMgr.config(function (eleventyConfig) {
    eleventyConfig.addFilter("testing", function () {
      return "tested.";
    });
  });
  let fn = await renderMgr.compile(
    `{%- set nunjucksVar = 69 -%}
{{ hi }}
{{ nunjucksVar }}
{{ "who" | testing }}
{% renderTemplate "liquid", argData %}
{% assign liquidVar = 138 %}
* {{ hi }} test test {{ bye }} {{ liquidVar }}
{% endrenderTemplate %}
`,
    "njk"
  );

  let data = {
    hi: "nunjucksHi",
    argData: {
      hi: "liquidHi",
      bye: "liquidBye",
    },
  };
  let html = await fn(data);

  t.is(
    normalizeNewLines(html.trim()),
    `nunjucksHi
69
tested.


* liquidHi test test liquidBye 138`
  );
});

test("Direct use of render string plugin, rendering Liquid (and nested Nunjucks)", async (t) => {
  let renderMgr = new RenderManager();
  renderMgr.config(function (eleventyConfig) {
    eleventyConfig.addFilter("testing", function () {
      return "tested.";
    });
  });

  let fn = await renderMgr.compile(
    `{%- assign liquidVar = 69 -%}
{{ hi }}
{{ liquidVar }}
{{ "who" | testing }}
{% renderTemplate "njk", argData %}
{% set njkVar = 138 %}
* {{ hi }} test test {{ bye }} {{ njkVar }}
{% endrenderTemplate %}
`,
    "liquid"
  );
  let data = {
    hi: "liquidHi",
    argData: {
      hi: "njkHi",
      bye: "njkBye",
    },
  };
  let html = await fn(data);

  t.is(
    normalizeNewLines(html.trim()),
    `liquidHi
69
tested.


* njkHi test test njkBye 138`
  );
});

test("Direct use of render file plugin, rendering Nunjucks (and nested Liquid)", async (t) => {
  let fn = await RenderPluginFile("./test/stubs-render-plugin/liquid-direct.njk", {
    config: function (eleventyConfig) {
      eleventyConfig.addPlugin(RenderPlugin);
      eleventyConfig.addFilter("testing", function () {
        return "tested.";
      });
    },
  });
  let data = {
    hi: "liquidHi",
    argData: {
      hi: "njkHi",
      bye: "njkBye",
    },
  };
  let html = await fn(data);

  t.is(
    normalizeNewLines(html.trim()),
    `liquidHi
69
tested.


* njkHi test test njkBye 138`
  );
});

test("Use page in renderTemplate (liquid in liquid)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-page.liquid");
  t.is(html, `/liquid-page/`);
});

test("Use page in renderTemplate (liquid in njk)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-page.njk");
  t.is(html, `/liquid-page/`);
});

test("Use page in renderTemplate (njk in liquid)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/njk-page.liquid");
  t.is(html, `/njk-page/`);
});

test("Use eleventy in renderTemplate (njk in liquid)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/njk-eleventy.liquid");
  t.true(html.startsWith("4."));
});

test("Use eleventy in renderTemplate (liquid in njk)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-eleventy.njk");
  t.true(html.startsWith("4."));
});
test.skip("Use nunjucks in liquid (access to all global data)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/nunjucks-global.liquid");
  t.is(html, `globalHi`);
});

test.skip("Use liquid in njk (access to all global data)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-global.njk");
  t.is(html, `globalHi`);
});

test("renderContent filter #3369 #3370 via renderTemplate (njk)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/nunjucks-frontmatter.njk", (eleventyConfig) => {
    eleventyConfig.addShortcode("test", () => "test content")
  });
  t.is(html, "test content");
});

test("#3368 #3810 config init bug with RenderManager", async (t) => {
  let elev = new Eleventy("./test/stubs-3810/", false, {
    configPath: "./test/stubs-3810/eleventy.config.js",
  });
  let results = await elev.toJSON();
  t.is(results[0].content, `<h1>Sign up for our newsletter!</h1>`);
});

async function getSharedConfig() {
  let templateConfig = new TemplateConfig(null, false);
  templateConfig.setDirectories(new ProjectDirectories());
  await templateConfig.init();
  return templateConfig;
}

test("Verify compileFile returns the same function with memoization (shared config)", async (t) => {
  const filePath = "./test/stubs-render-plugin/11tyjs-file.njk";
  let templateConfig = await getSharedConfig();
  let options = { templateConfig };

  let fn1 = await RenderPluginFile(filePath, options);
  let fn2 = await RenderPluginFile(filePath, options);

  t.is(fn1, fn2);
});

test("Verify compileFile returns different functions for different content (shared config)", async (t) => {
  const filePath = "./test/stubs-render-plugin/temp-file.njk";
  fs.writeFileSync(filePath, "content 1");

  let templateConfig = await getSharedConfig();
  let options = { templateConfig };

  let fn1 = await RenderPluginFile(filePath, options);

  fs.writeFileSync(filePath, "content 2");
  let fn2 = await RenderPluginFile(filePath, options);

  t.not(fn1, fn2);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
});

test("Verify compile (string) returns the same function with memoization (shared config)", async (t) => {
  let templateConfig = await getSharedConfig();
  let options = { templateConfig };
  const content = "Hello {{ name }}";

  // Need to mock this.page.templateSyntax if templateLang is not passed
  const context = { page: { templateSyntax: "njk" } };

  let fn1 = await RenderPluginString.call(context, content, "njk", options);
  let fn2 = await RenderPluginString.call(context, content, "njk", options);

  t.is(fn1, fn2);
});

