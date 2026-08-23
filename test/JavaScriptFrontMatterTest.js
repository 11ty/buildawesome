import test from "ava";
import Eleventy from "../src/Core.js";

test("Custom Front Matter Parsing Options (using JavaScript node-retrieve-globals)", async (t) => {
  let elev = new Eleventy("./test/stubs/script-frontmatter/test.njk", "./_site");
  elev.disableLogger();

  let result = await elev.toJSON();

  t.deepEqual(result.length, 1);

  t.is(result[0]?.content, `<div>Hi</div><div>Bye</div>`);
});

test("Custom Front Matter Parsing Options (using JavaScript node-retrieve-globals), override project-wide front matter default.", async (t) => {
  let elev = new Eleventy("./test/stubs/script-frontmatter/test-default.njk", "./_site", {
    config: ($config) => {
      $config.setFrontMatterParsingOptions({
        language: "js",
      });
    },
  });
  elev.disableLogger();

  let result = await elev.toJSON();

  t.deepEqual(result.length, 1);

  t.is(result[0]?.content, `<div>Hi</div><div>Bye</div>`);
});

test("Custom Front Matter Parsing Options (using backwards-compatible `js` instead of node-retrieve-globals)", async (t) => {
  let elev = new Eleventy("./test/stubs/script-frontmatter/test-js.njk", "./_site");
  elev.disableLogger();

  let result = await elev.toJSON();

  t.deepEqual(result.length, 1);

  t.is(result[0]?.content, `<div>HELLO!</div>`);
});

// https://github.com/11ty/eleventy/issues/3917
test("Issue #3917 previous JS object front matter shouldn’t have had implicit exports turned on", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
    config: function($config) {
      $config.addTemplate("test.njk", `---js
{
  eleventyComputed: {
    summary: async function (data) {
      let textInsert = data ? 'something' : 'nothing';
      return "Some text";
    }
  }
}
---
Hello`);
    }
  });
  elev.disableLogger();

  let result = await elev.toJSON();

  t.deepEqual(result.length, 1);

  t.is(result[0]?.content, `Hello`);
});
