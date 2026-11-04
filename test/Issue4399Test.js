import test from "node:test";
import Eleventy from "../src/Core.js";

test("#4399: Layouts and transforms skip pages that are not written", async (t) => {
  let transformed = [];
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: (eleventyConfig) => {
      eleventyConfig.addTransform("track", function (content) {
        transformed.push(this.page.inputPath);
        return content;
      });

      eleventyConfig.addTemplate("_includes/layout.njk", "Layout {{ content | safe }}");
      eleventyConfig.addTemplate("hidden.njk", "Hidden", { permalink: false, tags: "posts", layout: "layout.njk" });
      eleventyConfig.addTemplate("index.njk", "{% for post in collections.posts %}{{ post.templateContent | safe }}{% endfor %}");
    },
  });
  elev.setDryRun(true);

  await elev.write();
  t.assert.deepStrictEqual(transformed, ["./test/stubs-virtual/index.njk"]);

  let json = await elev.toJSON();
  t.assert.strictEqual(json.find((entry) => entry.inputPath.endsWith("hidden.njk")).content, "Layout Hidden");
});
