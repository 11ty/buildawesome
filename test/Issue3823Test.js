import test from "ava";
import Eleventy from "../src/Core.js";

test("#3823 addCollection -> pagination over `collections`", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addTemplate("post1.md", "# Post1");
      $config.addTemplate("post2.md", "# Post2");
      $config.addTemplate("index.njk", `---
pagination:
  data: collections
  size: 1
  alias: tag
  filter:
    - all
  addAllPagesToCollections: true
---
{{ tag }}`);

      $config.addCollection("posts", async collectionApi => {
        return collectionApi.getFilteredByGlob("**/post*.md");
      });
    }
  });

  let results = await elev.toJSON();
  results.sort();

  t.is(results.length, 3);
  t.is(results.filter((entry) => entry.url === "/")[0]?.content.trim(), "posts")
});
