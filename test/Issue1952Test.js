import test from "node:test";
import BuildAwesome from "../src/Core.js";

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

function getElev(addAllPagesToCollections) {
	return new BuildAwesome("./test/stubs-virtual/", undefined, {
		config(eleventyConfig) {
			eleventyConfig.addGlobalData("works", [
				{ slug: "a", tags: ["red"] },
				{ slug: "b", tags: ["red", "blue"] },
			]);
			eleventyConfig.addTemplate("static.njk", "", { tags: ["red"] });
			eleventyConfig.addTemplate("work.njk", "", {
				pagination: { data: "works", size: 1, alias: "work", addAllPagesToCollections },
				permalink: "/work/{{ work.slug }}/",
				eleventyComputed: { tags: (data) => data.work.tags },
			});
			eleventyConfig.addTemplate(
				"list.njk",
				"{% for p in collections.red %}{{ p.url }},{% endfor %}|{% for p in collections.blue %}{{ p.url }},{% endfor %}",
				{ permalink: "/list/", eleventyExcludeFromCollections: true },
			);
		},
	});
}

test("#1952: Computed `tags` from pagination data create collections", async (t) => {
	let elev = getElev(false);
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(results.find((entry) => entry.url === "/list/").content, "/static/,/work/a/,|");
	t.assert.deepStrictEqual(warnings, []);
});

test("#1952: Computed `tags` from pagination data create collections (addAllPagesToCollections)", async (t) => {
	let elev = getElev(true);
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(
		results.find((entry) => entry.url === "/list/").content,
		"/static/,/work/a/,/work/b/,|/work/b/,",
	);
	t.assert.deepStrictEqual(warnings, []);
});
