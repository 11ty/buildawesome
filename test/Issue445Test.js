import test from "node:test";
import Eleventy from "../src/Core.js";

async function getContent(input, inputPath, config) {
  let elev = new Eleventy(input, undefined, { quietMode: true, config });
  let results = await elev.toJSON();
  return results.find((entry) => entry.inputPath === inputPath).content.trim();
}

test("templateEngineOverride in a directory data file, Issue #445", async (t) => {
  t.assert.strictEqual(await getContent("./test/stubs-445/", "./test/stubs-445/blog/post.njk"), "<p><strong>bold</strong> {{ title }}</p>");
});

// Page renders as `njk` only, then the layout’s `njk,md` renders the combined output as Markdown
test("templateEngineOverride in layout front matter applies only to that layout, Issue #445", async (t) => {
  t.assert.strictEqual(
    await getContent("./test/stubs-virtual-nowrite/", "./test/stubs-virtual-nowrite/with-layout.njk", ($config) => {
      $config.addTemplate("with-layout.njk", `---
layout: layout.njk
title: Hi
---
**bold** {{ title }}
`);
      $config.addTemplate($config.directories.getLayoutPathRelativeToInputDirectory("layout.njk"), `---
templateEngineOverride: njk,md
---
**Layout** {{ content | safe }}
`);
    }),
    "<p><strong>Layout</strong> <strong>bold</strong> Hi</p>",
  );
});
