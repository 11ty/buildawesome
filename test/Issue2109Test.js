import test from "ava";
import Eleventy from "../src/Core.js";

// Global data files can’t be virtual, so only the templates are.
test("#2109: Global eleventyComputed data file uses each page’s own page data", async (t) => {
	let elev = new Eleventy("./test/stubs-2109/", "./test/stubs-2109/_site", {
		config(eleventyConfig) {
			for (let slug of ["a", "b", "c"]) {
				eleventyConfig.addTemplate(`${slug}.njk`, "{{ page.outputPath }}|{{ outputTest }}");
			}
		},
	});

	let results = await elev.toJSON();
	t.is(results.length, 3);
	for (let { content, outputPath } of results) {
		t.is(content, `${outputPath}|${outputPath}`);
	}
});
