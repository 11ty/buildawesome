import test from "ava";
import Eleventy from "../src/Core.js";

async function getContent(inputPath) {
  let elev = new Eleventy("./test/stubs-445/", undefined, { quietMode: true });
  let results = await elev.toJSON();
  return results.find((entry) => entry.inputPath === inputPath).content.trim();
}

test("templateEngineOverride in a directory data file, Issue #445", async (t) => {
  t.is(await getContent("./test/stubs-445/blog/post.njk"), "<p><strong>bold</strong> {{ title }}</p>");
});

// Page renders as `njk` only, then the layout’s `njk,md` renders the combined output as Markdown
test("templateEngineOverride in layout front matter applies only to that layout, Issue #445", async (t) => {
  t.is(
    await getContent("./test/stubs-445/with-layout.njk"),
    "<p><strong>Layout</strong> <strong>bold</strong> Hi</p>",
  );
});
