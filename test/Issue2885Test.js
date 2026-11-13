import test from "node:test";
import Eleventy from "../src/Core.js";

test("#2885: Filters called from computed data functions get each page’s `page` and `eleventy`", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config(eleventyConfig) {
			eleventyConfig.addFilter("pageFilter", function (value) {
				return `${value}|${this.page.fileSlug}|${typeof this.eleventy?.env}`;
			});
			eleventyConfig.addGlobalData("eleventyComputed", {
				filtered() {
					return this.pageFilter("test");
				},
			});
			for (let slug of ["a", "b"]) {
				eleventyConfig.addTemplate(`${slug}.njk`, "{{ filtered }}");
			}
		},
	});

	let results = await elev.toJSON();
	results.sort((a, b) => a.url.localeCompare(b.url));
	t.assert.deepStrictEqual(
		results.map(({ content }) => content),
		["test|a|object", "test|b|object"],
	);
});
