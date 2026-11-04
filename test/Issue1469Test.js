import test from "node:test";
import Eleventy from "../src/Core.js";

function captureWarnings(elev) {
	let warnings = [];
	elev.setIsVerbose(true);
	elev.logger.overrideLogger({
		log() {},
		info() {},
		error() {},
		warn(message) {
			warnings.push(message);
		},
	});
	return warnings;
}

function getElev(addTemplates) {
	return new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addTemplate("blog.njk", "", {
				eleventyComputed: {
					permalink: (data) => `/blog-${data.collections.all.length}/`,
				},
			});
			addTemplates?.(eleventyConfig);
		},
	});
}

test("#1469: Computed `permalink` reads collections", async (t) => {
	let elev = getElev();
	let warnings = captureWarnings(elev);

	let [result] = await elev.toJSON();
	t.assert.strictEqual(result.url, "/blog-1/");
	t.assert.strictEqual(result.outputPath, "./_site/blog-1/index.html");
	t.assert.strictEqual(warnings.length, 0);
});

test("#1469: Collections show the late URL at render time and in pagination", async (t) => {
	let elev = getElev((eleventyConfig) => {
		eleventyConfig.addTemplate("index.njk", "{% for entry in collections.all %}{{ entry.url }},{% endfor %}", {
			buildawesomeExcludeFromCollections: true,
		});
		eleventyConfig.addTemplate("paged.njk", "{{ entry.url }}", {
			buildawesomeExcludeFromCollections: true,
			pagination: { data: "collections.all", size: 1, alias: "entry" },
			permalink: "/paged/{{ pagination.pageNumber }}/",
		});
	});
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(results.find((entry) => entry.url === "/").content, "/blog-1/,");
	t.assert.strictEqual(results.find((entry) => entry.url === "/paged/0/").content, "/blog-1/");
	t.assert.strictEqual(warnings.length, 0);
});

test("#1469: Warns when other computed data reads the URL before it resolves", async (t) => {
	let elev = getElev((eleventyConfig) => {
		eleventyConfig.addTemplate("links.njk", "", {
			buildawesomeExcludeFromCollections: true,
			eleventyComputed: {
				links: (data) => data.collections.all.map((entry) => entry.url),
			},
		});
	});
	let warnings = captureWarnings(elev);

	await elev.toJSON();
	t.assert.strictEqual(warnings.length, 1);
	t.assert.strictEqual(warnings[0].includes(": ./test/noop/blog.njk › page.url › permalink › collections. "), true);
});
