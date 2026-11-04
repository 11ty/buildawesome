import test from "ava";
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

function getElev({ readFromOtherPage }) {
	return new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addTemplate("categories/css.md", "", { tags: "categories" });
			for (let slug of ["first", "second"]) {
				eleventyConfig.addTemplate(`articles/${slug}.md`, "", {
					tags: "articles",
					date: slug === "first" ? "2020-01-01" : "2020-01-02",
					eleventyComputed: {
						categoryCount: (data) => data.collections.categories.length,
						label: (data) => `${data.categoryCount} categories`,
					},
				});
			}
			eleventyConfig.addTemplate("page.njk", "{{ label }}|{{ article.data.label }}", {
				pagination: { data: "collections.articles", size: 1, alias: "article" },
				permalink: "/page/{{ pagination.pageNumber }}/",
				eleventyComputed: readFromOtherPage ? { label: (data) => data.article.data.label } : {},
			});
		},
	});
}

test("#2448: Warns once when computed data reads other pages’ unresolved computed data", async (t) => {
	let elev = getElev({ readFromOtherPage: true });
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.is(results.find((entry) => entry.url === "/page/0/").content, "|1 categories");
	t.is(warnings.length, 1);
	t.true(warnings[0].includes(": ./test/noop/articles/first.md › label › categoryCount › collections. "));
});

test("#2448: No warning when another page’s computed data is read after it resolves", async (t) => {
	let elev = getElev({ readFromOtherPage: false });
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.is(results.find((entry) => entry.url === "/page/0/").content, "|1 categories");
	t.is(warnings.length, 0);
});
