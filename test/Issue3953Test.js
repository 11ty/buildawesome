import test from "ava";
import Eleventy from "../src/Core.js";

test("#3953 Functions nested in computed data arrays, not shared across pages", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addGlobalData("client", { name: "Acme Co." });
      $config.addGlobalData("eleventyComputed", {
        schemaorg: {
          "@graph": [
            { name: (data) => data.client.name, title: "{{ title }}" },
            "{{ title }}",
            (data) => `fn-${data.title}`,
          ],
        },
      });
      $config.addTemplate("one.njk", `{{ schemaorg | dump | safe }}`, { title: "One" });
      $config.addTemplate("two.njk", `{{ schemaorg | dump | safe }}`, { title: "Two" });
    },
  });

  let results = await elev.toJSON();
  results.sort((a, b) => a.url.localeCompare(b.url));

  t.is(results.length, 2);
  t.is(results[0].content.trim(), `{"@graph":[{"name":"Acme Co.","title":"One"},"One","fn-One"]}`);
  t.is(results[1].content.trim(), `{"@graph":[{"name":"Acme Co.","title":"Two"},"Two","fn-Two"]}`);
});
