import test from "ava";
import Eleventy from "../src/Core.js";

async function render(addUniversal) {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: (eleventyConfig) => {
      addUniversal(eleventyConfig);
      eleventyConfig.addNunjucksAsyncShortcode("user", async (name) => `njk:${name}`);

      eleventyConfig.addTemplate("nunjucks.njk", `{% user "Zach" %}`);
      eleventyConfig.addTemplate("liquid.liquid", `{% user "Zach" %}`);
    },
  });

  let results = await elev.toJSON();
  return Object.fromEntries(results.map((entry) => [entry.inputPath.split(".").pop(), entry.content]));
}

test("#2325: Async universal shortcode and Nunjucks async shortcode with the same name", async (t) => {
  let content = await render((eleventyConfig) => {
    eleventyConfig.addShortcode("user", async (name) => `universal:${name}`);
  });

  t.deepEqual(content, { njk: "njk:Zach", liquid: "universal:Zach" });
});

test("#2325: Sync universal shortcode and Nunjucks async shortcode with the same name", async (t) => {
  let content = await render((eleventyConfig) => {
    eleventyConfig.addShortcode("user", (name) => `universal:${name}`);
  });

  t.deepEqual(content, { njk: "njk:Zach", liquid: "universal:Zach" });
});
