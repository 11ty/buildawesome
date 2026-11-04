import test from "node:test";
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

  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0]?.content.trim(), `http://example.com/:::[{"links":[{"url":"http://example.com/"}]}]`)
});
