import test from "node:test";

import {
  default as RenderPlugin,
  File as RenderPluginFile,
  String as RenderPluginString,
  RenderManager,
} from "../src/Plugins/RenderPlugin.js";
import Eleventy from "../src/Core.js";

import { normalizeNewLines } from "./Util/normalizeNewLines.js";
import { getTemplateConfigInstance } from "./_testHelpers.js";

async function getTestOutput(input, configCallback = function () {}) {
  let elev = new Eleventy(input, "./_site/", {
    config: function ($config) {
      $config.addPlugin(RenderPlugin);
      configCallback($config);
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
  t.assert.strictEqual(
    html,
    `nunjucksHi
69


* liquidHi test test liquidBye 138`
  );
});

test("Use liquid+markdown in 11ty.js", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-md.11ty.cjs");
  t.assert.strictEqual(
    html,
    `<h1>Markdown</h1>
<ul>
<li>2</li>
</ul>`
  );
});

test("Use nunjucks in 11ty.js", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/nunjucks.11ty.cjs");
  t.assert.strictEqual(html, `* iHtpircsavaj`);
});

// This is not yet supported and currently throws an error.
test.skip("Use 11ty.js in liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/11tyjs.liquid");
  t.assert.strictEqual(html, `TESTING`);
});

test("Use nunjucks in liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/nunjucks.liquid");
  t.assert.strictEqual(
    html,
    `* iHdiuqil
* lfjksdlba`
  );
});

test("Use markdown in liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/md.liquid");
  t.assert.strictEqual(
    html,
    `<h1>Hello {{ hi }}</h1>
<ul>
<li>Testing</li>
</ul>`
  );
});

test("Use nunjucks file in njk (uses renderTemplate inside of the nunjucks file)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/njk-file.njk");
  t.assert.strictEqual(
    html,
    `TESTING

TESTING IN LIQUID

* 999`
  );
});

test("Use 11ty.js file in njk", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/11tyjs-file.njk");
  t.assert.strictEqual(html, `TESTING`);
});

// 3.0 breaking change, we can’t alias to 11ty.js any more
test.skip("Breaking Change (3.0): Use txt file in njk (override to 11ty.js)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/11tyjs-file-override.njk");
  t.assert.strictEqual(html, `TESTING`);
});

test("Use nunjucks file in liquid but it doesn’t exist", async (t) => {
  await t.assert.rejects(async () => {
    await getTestOutputForFile("./test/stubs-render-plugin/njk-file-not-exist.liquid");
  });
});

test("No syntax passed, uses parent page syntax: liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/false.liquid");
  t.assert.strictEqual(
    html,
    `# Hello Bruno
* Testing`
  );
});

test("No syntax passed (uses parent page syntax), but does pass data: liquid", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/data-no-templatelang.liquid");
  t.assert.strictEqual(
    html,
    `# Hello Bruno
* Testing`
  );
});

// Not yet supported
test.skip("renderFile but the target has front matter.", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/using-frontmatter.liquid");
  t.assert.strictEqual(html, `frontmatterString`);
});

// Idea from https://twitter.com/raymondcamden/status/1460961620247650312
test("Capture nunjucks render output to a liquid variable", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/capture-njk.liquid");
  t.assert.strictEqual(html, `4`);
});

// Idea from https://twitter.com/raymondcamden/status/1460961620247650312
// Possibly blocked by async in {% set %} https://github.com/mozilla/nunjucks/issues/815
test("Capture liquid render output to a njk variable", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/capture-liquid.njk");
  t.assert.strictEqual(html, `4`);
});

test("Capture liquid render output to a njk variable (new async support for set)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/capture-liquid-set.njk");
  t.assert.strictEqual(html, `4`);
});

test("Remap non-object data to data._ if object is not passed in", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/bad-data.njk");
  t.assert.strictEqual(html, "string");
});

test("Direct use of render string plugin, rendering Nunjucks (and nested Liquid)", async (t) => {
  let renderMgr = new RenderManager();
  renderMgr.config(function ($config) {
    $config.addFilter("testing", function () {
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

  t.assert.strictEqual(
    normalizeNewLines(html.trim()),
    `nunjucksHi
69
tested.


* liquidHi test test liquidBye 138`
  );
});

test("Direct use of render string plugin, rendering Liquid (and nested Nunjucks)", async (t) => {
  let renderMgr = new RenderManager();
  renderMgr.config(function ($config) {
    $config.addFilter("testing", function () {
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

  t.assert.strictEqual(
    normalizeNewLines(html.trim()),
    `liquidHi
69
tested.


* njkHi test test njkBye 138`
  );
});

test("Direct use of render file plugin, rendering Nunjucks (and nested Liquid)", async (t) => {
  let fn = await RenderPluginFile("./test/stubs-render-plugin/liquid-direct.njk", {
    config: function ($config) {
      $config.addPlugin(RenderPlugin);
      $config.addFilter("testing", function () {
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

  t.assert.strictEqual(
    normalizeNewLines(html.trim()),
    `liquidHi
69
tested.


* njkHi test test njkBye 138`
  );
});

test("Use page in renderTemplate (liquid in liquid)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-page.liquid");
  t.assert.strictEqual(html, `/liquid-page/`);
});

test("Use page in renderTemplate (liquid in njk)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-page.njk");
  t.assert.strictEqual(html, `/liquid-page/`);
});

test("Use page in renderTemplate (njk in liquid)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/njk-page.liquid");
  t.assert.strictEqual(html, `/njk-page/`);
});

test("Use eleventy in renderTemplate (njk in liquid)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/njk-eleventy.liquid");
  t.assert.strictEqual(html.startsWith("4."), true);
});

test("Use eleventy in renderTemplate (liquid in njk)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-eleventy.njk");
  t.assert.strictEqual(html.startsWith("4."), true);
});
test.skip("Use nunjucks in liquid (access to all global data)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/nunjucks-global.liquid");
  t.assert.strictEqual(html, `globalHi`);
});

test.skip("Use liquid in njk (access to all global data)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/liquid-global.njk");
  t.assert.strictEqual(html, `globalHi`);
});

test("renderContent filter #3369 #3370 via renderTemplate (njk)", async (t) => {
  let html = await getTestOutputForFile("./test/stubs-render-plugin/nunjucks-frontmatter.njk", ($config) => {
    $config.addShortcode("test", () => "test content")
  });
  t.assert.strictEqual(html, "test content");
});

test("#3368 #3810 config init bug with RenderManager", async (t) => {
  let elev = new Eleventy("./test/stubs-3810/", false, {
    configPath: "./test/stubs-3810/eleventy.config.js",
  });
  let results = await elev.toJSON();
  t.assert.strictEqual(results[0].content, `<h1>Sign up for our newsletter!</h1>`);
});

async function getCustomExtensionOutput(renderFn) {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: ($config) => {
      $config.addPlugin(RenderPlugin);
      $config.addExtension("custom", {
        compile() {
          return (data) => renderFn($config.javascript.functions.renderTemplate, data);
        },
      });
      $config.addTemplateFormats("custom");
      $config.addTemplate("index.custom", "");
    },
  });

  let results = await elev.toJSON();
  return results[0].content;
}

test("#2912 renderTemplate called without a `this` context", async (t) => {
  let html = await getCustomExtensionOutput((renderTemplate, data) => {
    return renderTemplate("{{ page.url }}", "njk", { page: data.page });
  });
  t.assert.strictEqual(html, "/");
});

test("#2912 renderTemplate data `page` takes precedence over `this.page`", async (t) => {
  let html = await getCustomExtensionOutput((renderTemplate) => {
    return renderTemplate.call({ page: { url: "/context/" } }, "{{ page.url }}", "njk", { page: { url: "/data/" } });
  });
  t.assert.strictEqual(html, "/data/");
});

async function getCompileCount(pluginOptions, templates) {
  let counter = { compiles: 0 };
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.addPlugin(RenderPlugin, pluginOptions);
      $config.addExtension("cnt", {
        compile: (str) => {
          counter.compiles++;
          return (data) => `${str.trim()} ${data.name}`;
        },
      });
      for (let [name, content] of Object.entries(templates)) {
        $config.addTemplate(name, content);
      }
    },
  });

  let results = await elev.toJSON();
  let content = results.map((entry) => entry.content).sort();
  return { compileCount: counter.compiles, counter, content, elev };
}

const renderFileTemplates = {
  "a.njk": `{% renderFile "./test/stubs-render-plugin/_includes/cached.cnt", { name: "A" } %}`,
  "b.njk": `{% renderFile "./test/stubs-render-plugin/_includes/cached.cnt", { name: "B" } %}`,
};

const renderTemplateTemplates = {
  "a.njk": `{% renderTemplate "cnt", { name: "A" } %}Hello{% endrenderTemplate %}`,
  "b.njk": `{% renderTemplate "cnt", { name: "B" } %}Hello{% endrenderTemplate %}`,
};

test("renderFile compiles once per page by default", async (t) => {
  let { compileCount, content } = await getCompileCount(undefined, renderFileTemplates);
  t.assert.deepStrictEqual(content, ["Hello A", "Hello B"]);
  t.assert.strictEqual(compileCount, 2);
});

test("renderFile with memoize: 'file' compiles once", async (t) => {
  let { compileCount, content } = await getCompileCount({ memoize: "file" }, renderFileTemplates);
  t.assert.deepStrictEqual(content, ["Hello A", "Hello B"]);
  t.assert.strictEqual(compileCount, 1);
});

test("renderTemplate compiles once per page by default", async (t) => {
  let { compileCount, content } = await getCompileCount(undefined, renderTemplateTemplates);
  t.assert.deepStrictEqual(content, ["Hello A", "Hello B"]);
  t.assert.strictEqual(compileCount, 2);
});

test("renderTemplate with memoize: 'string' compiles once", async (t) => {
  let { compileCount, content } = await getCompileCount({ memoize: "string" }, renderTemplateTemplates);
  t.assert.deepStrictEqual(content, ["Hello A", "Hello B"]);
  t.assert.strictEqual(compileCount, 1);
});

test("renderFile with memoize: 'file' clears on resource modified", async (t) => {
  let { counter, elev } = await getCompileCount({ memoize: "file" }, renderFileTemplates);
  t.assert.strictEqual(counter.compiles, 1);

  elev.eleventyConfig.eventBus.emit("buildawesome.resourcemodified", "./test/stubs-render-plugin/_includes/cached.cnt");
  await elev.toJSON();
  t.assert.strictEqual(counter.compiles, 2);
});

test("memoize: 'file,string' memoizes both", async (t) => {
  let { compileCount, content } = await getCompileCount({ memoize: "file,string" }, {
    ...renderFileTemplates,
    "c.njk": `{% renderTemplate "cnt", { name: "C" } %}Hi{% endrenderTemplate %}`,
    "d.njk": `{% renderTemplate "cnt", { name: "D" } %}Hi{% endrenderTemplate %}`,
  });
  t.assert.deepStrictEqual(content, ["Hello A", "Hello B", "Hi C", "Hi D"]);
  t.assert.strictEqual(compileCount, 2);
});

test("Compiling without an extensionMap reuses engines (no listener per call)", async (t) => {
  let templateConfig = await getTemplateConfigInstance();
  let events = templateConfig.userConfig.events;
  let count = () => events.listenerCount("buildawesome#templatemodified");
  let before = count();

  for (let j = 0; j < 10; j++) {
    let fn = await RenderPluginString.call({}, "{{ x }}", "njk", { templateConfig });
    t.assert.strictEqual(await fn({ x: j }), String(j));
  }

  t.assert.strictEqual(count(), before + 1);

  // A changed file drops the reused engines
  templateConfig.eventBus.emit("buildawesome.resourcemodified", "./test/stubs/index.njk");
  await new Promise((resolve) => setTimeout(resolve, 0));
  t.assert.strictEqual(count(), before);

  let fn = await RenderPluginString.call({}, "{{ x }}", "njk", { templateConfig });
  t.assert.strictEqual(await fn({ x: "ok" }), "ok");
});
