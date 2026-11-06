import test from "node:test";
import Eleventy from "../src/Core.js";

test("#3931 Config API collection is complete when a tagged template paginates over it", async (t) => {
	let warnings = [];
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addCollection("blogTagList", (collectionApi) => {
				let tags = new Set();
				for (let item of collectionApi.getAll()) {
					for (let tag of item.data.blogTags || []) {
						tags.add(tag);
					}
				}
				return Array.from(tags).sort();
			});

			eleventyConfig.addTemplate("post1.md", "Post", { tags: ["blog"], blogTags: ["a", "b"] });
			eleventyConfig.addTemplate("post2.md", "Post", { tags: ["blog"], blogTags: ["c"] });
			eleventyConfig.addTemplate("note1.md", "Note", { tags: ["note"], blogTags: ["d"] });
			// Tagged like the posts, e.g. via shared directory data.
			eleventyConfig.addTemplate("tag.liquid", "{{ tag }}", {
				tags: ["blog"],
				pagination: { data: "collections.blogTagList", size: 1, alias: "tag" },
				permalink: "/tags/{{ tag }}/",
			});
		},
	});
	elev.setIsVerbose(true);
	elev.logger.overrideLogger({
		log() {},
		info() {},
		error() {},
		warn(message) {
			warnings.push(message);
		},
	});

	let results = await elev.toJSON();
	let tagUrls = results
		.filter((entry) => entry.url.startsWith("/tags/"))
		.map((entry) => entry.url)
		.sort();
	t.assert.deepStrictEqual(tagUrls, ["/tags/a/", "/tags/b/", "/tags/c/", "/tags/d/"]);
	t.assert.deepStrictEqual(warnings, []);
});
