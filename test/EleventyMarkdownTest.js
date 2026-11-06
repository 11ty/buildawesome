import test from "node:test";
import Eleventy from "../src/Core.js";

test("Markdown in markdown #3954", async (t) => {
  let elev = new Eleventy({
    input: "./test/stubs-virtual/",
    config: $config => {
      $config.addTemplate("_includes/layout.md", `{{ content }}`);
      $config.addTemplate("index.md", `---
layout: layout.md
---
#  Heading

\`\`\`
# This is code

# This is another code
\`\`\``);
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content.trim(), `<h1>Heading</h1>
<pre><code># This is code

# This is another code
</code></pre>`);
});


test("Preprocess Markdown with markdown #3925", async (t) => {
  let elev = new Eleventy({
    input: "./test/stubs-virtual/",
    config: $config => {
      $config.setMarkdownTemplateEngine("md");
      $config.addTemplate("index.md", `#  Heading

\`\`\`
# This is code

# This is another code
\`\`\``);
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content.trim(), `<h1>Heading</h1>
<pre><code># This is code

# This is another code
</code></pre>`);
});

test("Preprocessing engine does not need to be in templateFormats #514", async (t) => {
  let elev = new Eleventy({
    input: "./test/stubs-virtual/",
    config: $config => {
      $config.setTemplateFormats(["md", "html"]);
      $config.setMarkdownTemplateEngine("liquid");
      $config.setHtmlTemplateEngine("liquid");
      $config.addTemplate("index.md", `{% assign x = "md" %}{{ x }}`);
      $config.addTemplate("page.html", `{% assign x = "html" %}{{ x }}`);
    }
  });

  let results = await elev.toJSON();
  let contents = results.map(({ content }) => content.trim()).sort();
  t.assert.deepStrictEqual(contents, ["<p>md</p>", "html"]);
});
