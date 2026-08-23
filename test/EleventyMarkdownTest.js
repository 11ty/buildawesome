import test from "ava";
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
  t.is(results.length, 1);
  t.is(results[0].content.trim(), `<h1>Heading</h1>
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
  t.is(results.length, 1);
  t.is(results[0].content.trim(), `<h1>Heading</h1>
<pre><code># This is code

# This is another code
</code></pre>`);
});
