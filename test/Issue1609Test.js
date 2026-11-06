import test from "node:test";
import Eleventy from "../src/Core.js";

test("#1609: Custom filter in a paginated eleventyComputed template string gets the pagination alias", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config(eleventyConfig) {
			eleventyConfig.addFilter("formatTag", (tag) => {
				if (typeof tag !== "string") {
					throw new Error(`Expected a string, received ${typeof tag}`);
				}
				return tag.toUpperCase();
			});
			eleventyConfig.addTemplate("post.md", "", { tags: ["css", "webgl"] });
			eleventyConfig.addTemplate("tag.njk", "{{ title }}", {
				pagination: {
					data: "collections",
					size: 1,
					alias: "tag",
					filter: ["all"],
				},
				permalink: "/tag-{{ tag }}/",
				eleventyComputed: {
					title: "Posts tagged “{{ tag | formatTag }}”",
				},
			});
		},
	});

	let results = (await elev.toJSON()).filter(({ url }) => url.startsWith("/tag-"));
	results.sort((a, b) => a.url.localeCompare(b.url));
	t.assert.deepStrictEqual(
		results.map(({ content }) => content),
		["Posts tagged “CSS”", "Posts tagged “WEBGL”"],
	);
});
