import test from "ava";
import md from "markdown-it";
import { full as mdEmoji } from 'markdown-it-emoji'
import eleventySyntaxHighlightPlugin from "@11ty/eleventy-plugin-syntaxhighlight";

import TemplateRender from "../src/TemplateRender.js";
import Liquid from "../src/Engines/Liquid.js";
import Nunjucks from "../src/Engines/Nunjucks.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";

import { normalizeNewLines } from "./Util/normalizeNewLines.js";
import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

async function getNewTemplateRender(name, inputDir, eleventyConfig) {
  if (!eleventyConfig) {
    eleventyConfig = await getTemplateConfigInstance({
      dir: {
        input: inputDir
      }
    });
  }

  let tr = new TemplateRender(name, eleventyConfig);
  tr.extensionMap = new ExtensionMap(eleventyConfig);
  tr.extensionMap.engineManager = new TemplateEngineManager(eleventyConfig);
  tr.extensionMap.setFormats([]);
  await tr.init();
  return tr;
}

// Markdown
test("Markdown", async (t) => {
  let tr = await getNewTemplateRender("md");
  t.is(tr.getEngineName(), "md");
});

test("Markdown Render: Parses base markdown, no data", async (t) => {
  let tr = await getNewTemplateRender("md");
  let fn = await tr.getCompiledTemplate("# My Title");
  t.is((await fn()).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Markdown should work with HTML too", async (t) => {
  let tr = await getNewTemplateRender("md");
  let fn = await tr.getCompiledTemplate("<h1>My Title</h1>");
  t.is((await fn()).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Parses markdown using liquid engine (default, with data)", async (t) => {
  let tr = await getNewTemplateRender("md");
  let fn = await tr.getCompiledTemplate("# {{title}}");
  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Ignore markdown, use only preprocess engine (useful for variable resolution in permalinks)", async (t) => {
  let tr = await getNewTemplateRender("md");
  tr.setUseMarkdown(false);

  let fn = await tr.getCompiledTemplate("{{title}}");
  t.is((await fn({ title: "My Title" })).trim(), "My Title");
});

test("Markdown Render: Skip markdown and preprocess engine (issue #466)", async (t) => {
  let tr = await getNewTemplateRender("md");
  tr.setMarkdownEngine(false);
  tr.setUseMarkdown(false);
  let fn = await tr.getCompiledTemplate("404.html");
  t.is((await fn({ title: "My Title" })).trim(), "404.html");
});

test("Markdown Render: Set markdown engine to false, don’t parse", async (t) => {
  let tr = await getNewTemplateRender("md");
  tr.setMarkdownEngine(false);
  let fn = await tr.getCompiledTemplate("# {{title}}");
  t.is((await fn()).trim(), "<h1>{{title}}</h1>");
});

test("Markdown Render: Set markdown engine to false, don’t parse (test with HTML input)", async (t) => {
  let tr = await getNewTemplateRender("md");
  tr.setMarkdownEngine(false);
  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");

  t.is((await fn()).trim(), "<h1>{{title}}</h1>");
});

test("Markdown Render: Pass in an override (liquid)", async (t) => {
  let tr = await getNewTemplateRender("md");
  tr.setMarkdownEngine("liquid");
  let fn = await tr.getCompiledTemplate("# {{title}}");

  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Strikethrough", async (t) => {
  let tr = await getNewTemplateRender("md");
  let fn = await tr.getCompiledTemplate("~~No~~");
  t.is((await fn()).trim(), "<p><s>No</s></p>");
});

test("Markdown Render: Strikethrough in a Header", async (t) => {
  let tr = await getNewTemplateRender("md");
  let fn = await tr.getCompiledTemplate("# ~~No~~");
  t.is((await fn()).trim(), "<h1><s>No</s></h1>");
});

test("Markdown Render: with Library Override", async (t) => {
  let tr = await getNewTemplateRender("md");

  let mdLib = md();
  tr.engine.setLibrary(mdLib);
  t.is(mdLib.render(":)").trim(), "<p>:)</p>");

  let fn = await tr.getCompiledTemplate(":)");
  t.is((await fn()).trim(), "<p>:)</p>");
});

test("Markdown Render: with Library Override and a Plugin", async (t) => {
  let tr = await getNewTemplateRender("md");

  let mdLib = md().use(mdEmoji);
  tr.engine.setLibrary(mdLib);
  t.is(mdLib.render(":)").trim(), "<p>😃</p>");

  let fn = await tr.getCompiledTemplate(":)");
  t.is((await fn()).trim(), "<p>😃</p>");
});

test("Markdown Render: use a custom highlighter", async (t) => {
  let tr = await getNewTemplateRender("md");

  let mdLib = md();
  mdLib.set({
    highlight: function (str, lang) {
      return "This is overrrrrrride";
    },
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`
This is some code.
\`\`\``);
  t.is((await fn()).trim(), "<pre><code>This is overrrrrrride</code></pre>");
});

test("Markdown Render: use prism highlighter (no language)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addPlugin(eleventySyntaxHighlightPlugin);
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let markdownHighlight = eleventyConfig.getConfig().markdownHighlighter;
  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`
This is some code.
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre><code>This is some code.
</code></pre>`
  );
});

test("Markdown Render: use prism highlighter", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addPlugin(eleventySyntaxHighlightPlugin);
    }
  );

  let tr = await getNewTemplateRender("md");

  let markdownHighlight = eleventyConfig.getConfig().markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\` js
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-js"><code class="language-js"><span class="token keyword">var</span> key <span class="token operator">=</span> <span class="token string">"value"</span><span class="token punctuation">;</span></code></pre>`
  );
});

test("Markdown Render: use prism highlighter (no space before language)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addPlugin(eleventySyntaxHighlightPlugin);
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let markdownHighlight = eleventyConfig.getConfig().markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`js
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-js"><code class="language-js"><span class="token keyword">var</span> key <span class="token operator">=</span> <span class="token string">"value"</span><span class="token punctuation">;</span></code></pre>`
  );
});

test("Markdown Render: use prism highlighter, line highlighting", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addPlugin(eleventySyntaxHighlightPlugin);
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);
  let markdownHighlight = eleventyConfig.getConfig().markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`js/0
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-js"><code class="language-js"><mark class="highlight-line highlight-line-active"><span class="token keyword">var</span> key <span class="token operator">=</span> <span class="token string">"value"</span><span class="token punctuation">;</span></mark></code></pre>`
  );
});

test("Markdown Render: use prism highlighter, line highlighting with fallback `text` language.", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addPlugin(eleventySyntaxHighlightPlugin);
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let cfg = eleventyConfig.getConfig();
  let markdownHighlight = cfg.markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\` text/0
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-text"><code class="language-text"><mark class="highlight-line highlight-line-active">var key = "value";</mark></code></pre>`
  );
});

test("Markdown Render: use Markdown inside of a Liquid shortcode (Issue #536)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let liquidEngine = new Liquid("liquid", eleventyConfig);
  liquidEngine.addShortcode("testShortcode", function () {
    return "## My Other Title";
  });
  tr.setMarkdownEngine(liquidEngine);

  let fn = await tr.getCompiledTemplate(`# {{title}}
{% testShortcode %}`);
  t.is(
    (
      await fn({
        title: "My Title",
        otherTitle: "My Other Title",
      })
    ).trim(),
    `<h1>My Title</h1>
<h2>My Other Title</h2>`
  );
});

test("Markdown Render: use Markdown inside of a Nunjucks shortcode (Issue #536)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  let tr = await getNewTemplateRender("md", null, eleventyConfig);
  let nunjucksEngine = new Nunjucks("njk", eleventyConfig);
  nunjucksEngine.addShortcode("testShortcode", function () {
    return "## My Other Title";
  });
  tr.setMarkdownEngine(nunjucksEngine);

  let fn = await tr.getCompiledTemplate(`# {{title}}
{% testShortcode %}`);
  t.is(
    (
      await fn({
        title: "My Title",
        otherTitle: "My Other Title",
      })
    ).trim(),
    `<h1>My Title</h1>
<h2>My Other Title</h2>`
  );
});

test("Markdown Render: use Markdown inside of a Liquid paired shortcode (Issue #536)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let liquidEngine = new Liquid("liquid", eleventyConfig);
  liquidEngine.addPairedShortcode("testShortcode", function (content) {
    return content;
  });
  tr.setMarkdownEngine(liquidEngine);

  let fn = await tr.getCompiledTemplate(`# {{title}}
{% testShortcode %}## My Other Title{% endtestShortcode %}`);
  t.is(
    (
      await fn({
        title: "My Title",
        otherTitle: "My Other Title",
      })
    ).trim(),
    `<h1>My Title</h1>
<h2>My Other Title</h2>`
  );
});

test("Markdown Render: use Markdown inside of a Nunjucks paired shortcode (Issue #536)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();
  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let nunjucksEngine = new Nunjucks("njk", eleventyConfig);
  nunjucksEngine.addPairedShortcode("testShortcode", function (content) {
    return content;
  });
  tr.setMarkdownEngine(nunjucksEngine);

  let fn = await tr.getCompiledTemplate(`# {{title}}
{% testShortcode %}## My Other Title{% endtestShortcode %}`);
  t.is(
    (
      await fn({
        title: "My Title",
        otherTitle: "My Other Title",
      })
    ).trim(),
    `<h1>My Title</h1>
<h2>My Other Title</h2>`
  );
});

test("Markdown Render: Disable indented code blocks by default. Issue #2438", async (t) => {
  let tr = await getNewTemplateRender("md");
  let fn = await tr.getCompiledTemplate("    This is a test");
  t.is((await fn()).trim(), "<p>This is a test</p>");
});

test("Markdown Render: setLibrary does not have disabled indented code blocks either. Issue #2438", async (t) => {
  let tr = await getNewTemplateRender("md");

  let mdLib = md();
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate("    This is a test");
  let content = await fn();
  t.is(content.trim(), "<p>This is a test</p>");
});

test("Markdown Render: use amendLibrary to re-enable indented code blocks. Issue #2438", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.amendLibrary("md", (lib) => lib.enable("code"));
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let fn = await tr.getCompiledTemplate("    This is a test");
  let content = await fn();
  t.is(
    normalizeNewLines(content.trim()),
    `<pre><code>This is a test
</code></pre>`
  );
});

test("Markdown Render: amendLibrary works with setLibrary to re-enable indented code blocks. Issue #2438", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.amendLibrary("md", (lib) => lib.enable("code"));
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let mdLib = md();
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate("    This is a test");
  let content = await fn();
  t.is(
    normalizeNewLines(content.trim()),
    `<pre><code>This is a test
</code></pre>`
  );
});

test("Markdown Render: multiple amendLibrary calls. Issue #2438", async (t) => {
  t.plan(3);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.amendLibrary("md", (lib) => {
        t.true(true);
        lib.enable("code");
      });
      cfg.amendLibrary("md", (lib) => {
        t.true(true);
        lib.disable("code");
      });
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let fn = await tr.getCompiledTemplate("    This is a test");
  let content = await fn();
  t.is(normalizeNewLines(content.trim()), "<p>This is a test</p>");
});

test("Markdown Render: use amendLibrary to add a Plugin", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.amendLibrary("md", (mdLib) => mdLib.use(mdEmoji));
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);
  let fn = await tr.getCompiledTemplate(":)");
  t.is((await fn()).trim(), "<p>😃</p>");
});
