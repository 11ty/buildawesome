import test from "node:test";
import Eleventy from "../src/Core.js";

async function getTransformedOutputPaths(items) {
  let outputPaths = [];
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: (eleventyConfig) => {
      eleventyConfig.addTransform("track", function (content) {
        outputPaths.push(this.page.outputPath);
        return content;
      });

      eleventyConfig.addTemplate("page.njk", "{{ item.slug }}", {
        items,
        pagination: { data: "items", size: 1, alias: "item" },
        eleventyComputed: {
          permalink: (data) => (data.item.slug ? `/${data.item.slug}/` : false),
        },
      });
    },
  });
  elev.setDryRun(true);
  await elev.write();
  return outputPaths;
}

test("#2806: Paginated computed `permalink: false` (false page last)", async (t) => {
  t.assert.deepStrictEqual(await getTransformedOutputPaths([{ slug: "a" }, {}]), ["./_site/a/index.html"]);
});

test("#2806: Paginated computed `permalink: false` (false page first)", async (t) => {
  t.assert.deepStrictEqual(await getTransformedOutputPaths([{}, { slug: "a" }]), ["./_site/a/index.html"]);
});
