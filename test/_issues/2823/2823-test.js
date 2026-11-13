import test from "node:test";
import Eleventy from "../../../src/Core.js";

test("Issue #2823, dynamicPermalink: false bypasses custom engine compileOptions.permalink", async (t) => {
	let elev = new Eleventy("./test/_issues/2823/", "./test/_issues/2823/_site", {
		config: function (eleventyConfig) {
			eleventyConfig.addTemplateFormats("txt");
			eleventyConfig.addExtension("txt", {
				compile: (str) => () => str,
				compileOptions: {
					permalink: () => {
						throw new Error("compileOptions.permalink should not be called");
					},
				},
			});
		},
	});

	let results = await elev.toJSON();
	results.sort((a, b) => a.url.localeCompare(b.url));

	t.assert.deepStrictEqual(
		results.map(({ url, content }) => ({ url, content: content.trim() })),
		[
			{ url: "/custom-raw/", content: "With permalink" },
			{ url: "/no-permalink/", content: "No permalink" },
		],
	);
});
