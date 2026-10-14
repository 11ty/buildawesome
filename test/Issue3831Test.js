import test from "ava";
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

  t.is(results.length, 1);
  t.is(results[0]?.content.trim(), `/url/glossary/entity/#webpage
T`)
});
