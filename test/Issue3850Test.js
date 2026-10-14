import test from "ava";
import Eleventy from "../src/Core.js";

test("#3850 Computed Data regression part 2", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addTemplate("index.njk", `---
site:
  download_link_mac: "http://example.com/"
eleventyComputed:
  downloads:
  -
    links:
    -
      url: "{{ site.download_link_mac }}"
---
{{ site.download_link_mac }}:::{{ downloads | dump | safe }}`);
    }
  });

  let results = await elev.toJSON();
  results.sort();

  t.is(results.length, 1);
  t.is(results[0]?.content.trim(), `http://example.com/:::[{"links":[{"url":"http://example.com/"}]}]`)
});
