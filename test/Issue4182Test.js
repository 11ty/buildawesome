import test from "ava";
import Eleventy from "../src/Eleventy.js";

test("#4182 addCollection consuming a tagged collection should not run before tag publishers", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config(eleventyConfig) {
      eleventyConfig.setLayoutsDirectory("_layouts");
      eleventyConfig.addCollection("primaryNav", (collectionApi) => {
        return collectionApi.getFilteredByTag("primary");
      });

      eleventyConfig.addTemplate(
        "_layouts/base.liquid",
        `{% for item in collections.primaryNav %}{{ item.url }} {% endfor %}{{ content }}`,
        {
          eleventyImport: {
            collections: ["primaryNav"],
          },
        },
      );

      eleventyConfig.addTemplate("blog.liquid", "Blog", {
        tags: ["primary"],
        permalink: "/blog/",
        layout: "base.liquid",
      });

      eleventyConfig.addTemplate("about.liquid", "About", {
        tags: ["primary"],
        permalink: "/about/",
        layout: "base.liquid",
      });

      eleventyConfig.addTemplate("index.liquid", "Home", {
        layout: "base.liquid",
      });
    },
  });

  let results = await elev.toJSON();
  let homepage = results.find((entry) => entry.url === "/");

  t.truthy(homepage);
  t.true(homepage.content.includes("/blog/"));
  t.true(homepage.content.includes("/about/"));
});
