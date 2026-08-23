import test from "ava";
import Eleventy from "../src/Core.js";

test("#3825 #3834 addCollection consumes tag from pagination template", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addTemplate("post1.md", "# Post1");
      $config.addTemplate("post2.md", "# Post2");

      $config.addCollection("posts", async collectionApi => {
        return collectionApi.getFilteredByGlob("**/post*.md");
      });

			$config.addCollection("myCollection", collectionApi => {
				// populated by child.njk
				return collectionApi.getFilteredByTag("childTag");
			})

      $config.addTemplate("child.njk", `---
pagination:
  data: collections.posts
  size: 1
  alias: tag
  filter:
    - all
  addAllPagesToCollections: true
tags: childTag
---
{{ tag }}`);

      $config.addTemplate("index.njk", `{{ collections.myCollection.length }}`, {
        // eleventyImport: {
        //   collections: ["myCollection"]
        // }
      });
    }
  });

  let results = await elev.toJSON();

  t.is(results.length, 5);
  t.is(results.filter((entry) => entry.url === "/")[0]?.content.trim(), "2")
});

test("#3825 addCollection consumes tag from pagination template", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addTemplate("post1.md", "# Post1");
      $config.addTemplate("post2.md", "# Post2");

      $config.addCollection("homepageLinks", function(collectionApi) {
        // glob consumes pagination over another userconfig collection
        return collectionApi.getFilteredByGlob(["**/principles.njk"]);
      });

      $config.addCollection("getAllPrinciplesOrderedByTitle", function(collectionApi) {
        return collectionApi.getFilteredByGlob("**/post*.md");
      });

      $config.addTemplate("principles.njk", `---
pagination:
  data: collections.getAllPrinciplesOrderedByTitle
  size: 1
  alias: tag
  filter:
    - all
  addAllPagesToCollections: true
---
{{ tag }}`);

      $config.addTemplate("index.njk", `{{ collections.homepageLinks.length }}`, {
        // eleventyImport: {
        //   collections: ["homepageLinks"]
        // }
      });
    }
  });

  let results = await elev.toJSON();

  t.is(results.length, 5);
  t.is(results.filter((entry) => entry.url === "/")[0]?.content.trim(), "2")
});

test("Side-issue #3825 #3834 tried to Reflect.has on a string in pagination", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addTemplate("post1.md", "# Post1");
      $config.addTemplate("post2.md", "# Post2");

      $config.addCollection("posts", async collectionApi => {
        return collectionApi.getFilteredByGlob("**/post*.md");
      });

			$config.addCollection("myCollection", collectionApi => {
				// populated by child.njk
				return collectionApi.getFilteredByTag("someArbitraryTag");
			})

      $config.addTemplate("child.njk", `---
pagination:
  data: collections.posts
  size: 1
  alias: tag
  filter:
    - all
  addAllPagesToCollections: true
# Warning: this is tag not the expected tags
tag: someArbitraryTag
---
{{ tag }}`);

      $config.addTemplate("index.njk", `{{ collections.myCollection.length }}`);
    }
  });

  let results = await elev.toJSON();

  t.is(results.length, 5);
  t.is(results.filter((entry) => entry.url === "/")[0]?.content.trim(), "0")
});
