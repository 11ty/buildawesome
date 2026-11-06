import test from "node:test";
import Eleventy from "../src/Core.js";

test("#3831 Computed Data regression", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addGlobalData("eleventyComputed", {
        first_letter: function (data) { return data.title[0] }
      });

      $config.addTemplate("index.njk", `---
title: "Title"
metadata:
  url: "/url/"
eleventyComputed:
  "id": "{{ metadata.url }}glossary/entity/#webpage"
---
{{ id }}
{{ first_letter }}`);
    }
  });

  let results = await elev.toJSON();
  results.sort();

  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0]?.content.trim(), `/url/glossary/entity/#webpage
T`)
});
