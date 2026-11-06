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

function getElev(pageData, { content = "T[{{ fromLayout }}|{{ title }}]", pages = ["first", "second"] } = {}) {
	return new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addTemplate("_includes/base.njk", "L[{{ fromLayout }}]{{ content | safe }}", {
				fromLayout: "base",
				title: "base title",
			});
			eleventyConfig.addTemplate("_includes/other.njk", "O[{{ fromLayout }}|{{ fromOther }}]{{ content | safe }}", {
				fromLayout: "other",
				fromOther: "other only",
			});
			for (let slug of pages) {
				eleventyConfig.addTemplate(`${slug}.njk`, content, pageData);
			}
		},
	});
}

test("#2236: Computed `layout` applies the layout’s front matter", async (t) => {
	let elev = getElev({ title: "page title", eleventyComputed: { layout: "base.njk" } });
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(results[0].content, "L[base]T[base|page title]");
	t.assert.strictEqual(warnings.length, 0);
});

test("#2236: Other computed data sees the computed layout’s front matter", async (t) => {
	let elev = getElev({
		eleventyComputed: {
			title: (data) => `${data.fromLayout}!`,
			layout: "base.njk",
		},
	});

	let results = await elev.toJSON();
	t.assert.strictEqual(results[0].content, "L[base]T[base|base!]");
});

test("#2236: Computed `layout` replaces the cascade layout’s front matter", async (t) => {
	let elev = getElev(
		{ layout: "other.njk", eleventyComputed: { layout: "base.njk" } },
		{ content: "T[{{ fromLayout }}|{{ fromOther }}]" },
	);

	let results = await elev.toJSON();
	t.assert.strictEqual(results[0].content, "L[base]T[base|]");
});

test("#2236: Computed `layout` per paginated page", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addTemplate("_includes/paged-a.njk", "A[{{ fromLayout }}]{{ content | safe }}", { fromLayout: "a" });
			eleventyConfig.addTemplate("_includes/paged-b.njk", "B[{{ fromLayout }}]{{ content | safe }}", { fromLayout: "b" });
			eleventyConfig.addTemplate("page.njk", "T[{{ fromLayout }}]", {
				items: ["paged-a.njk", "paged-b.njk"],
				pagination: { data: "items", size: 1, alias: "item" },
				eleventyComputed: { layout: (data) => data.item },
			});
		},
	});
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.deepStrictEqual(results.map((entry) => entry.content).sort(), ["A[a]T[a]", "B[b]T[b]"]);
	t.assert.strictEqual(warnings.length, 0);
});

test("#2236: Warns once when a computed `layout` reads collections", async (t) => {
	let elev = getElev({
		tags: "pages",
		eleventyComputed: { layout: (data) => (data.collections.pages.length ? "base.njk" : undefined) },
	});
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(results[0].content, "L[]T[|]");
	t.assert.strictEqual(warnings.length, 1);
	t.assert.strictEqual(warnings[0].includes("`layout` to `base.njk`"), true);
});

test("#2236: No warning when `layout` is set outside computed data", async (t) => {
	let elev = getElev({ layout: "base.njk" });
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(results[0].content, "L[base]T[base|base title]");
	t.assert.strictEqual(warnings.length, 0);
});
