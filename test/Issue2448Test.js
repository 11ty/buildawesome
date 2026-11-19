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
			// Verbose mode also warns about slow benchmarks, which happens under load.
			if (!/\bBenchmark\s/.test(message)) {
				warnings.push(message);
			}
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
	t.assert.strictEqual(results.find((entry) => entry.url === "/page/0/").content, "|1 categories");
	t.assert.strictEqual(warnings.length, 1);
	t.assert.strictEqual(warnings[0].includes(": ./test/noop/articles/first.md › label › categoryCount › collections. "), true);
});

test("#2448: No warning when another page’s computed data is read after it resolves", async (t) => {
	let elev = getElev({ readFromOtherPage: false });
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(results.find((entry) => entry.url === "/page/0/").content, "|1 categories");
	t.assert.strictEqual(warnings.length, 0);
});

test("#2448: Warns when a preprocessor reads computed data before it resolves", async (t) => {
	let seen;
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addPreprocessor("check", "njk", (data) => {
				seen = data.title;
			});
			eleventyConfig.addTemplate("lazy.njk", "{{ title }}", {
				title: "front matter",
				eleventyComputed: { title: () => "computed" },
			});
		},
	});
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(seen, "front matter");
	t.assert.strictEqual(results[0].content, "computed");
	t.assert.strictEqual(warnings.length, 1);
	t.assert.strictEqual(warnings[0].includes(": ./test/noop/lazy.njk › title. Computed data resolves after preprocessors"), true);
});

test("#2448: No warning when a preprocessor reads computed data resolved before preprocessors", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addPreprocessor("check", "njk", (data) => {
				data.page.date;
				data.layout;
			});
			eleventyConfig.addTemplate("_includes/early.njk", "{{ content | safe }}");
			eleventyConfig.addTemplate("early.njk", "", {
				eleventyComputed: { date: () => "2001-02-03", layout: () => "early.njk" },
			});
		},
	});
	let warnings = captureWarnings(elev);

	await elev.toJSON();
	t.assert.strictEqual(warnings.length, 0);
});

test("#2448: No warning when a dotted computed key reads its own previous value", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addTemplate("seo.njk", "{{ seo.image }}", {
				seo: { image: "/a.jpg" },
				eleventyComputed: { seo: { image: (data) => data.seo?.image || "/fallback.jpg" } },
			});
		},
	});
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(results[0].content, "/a.jpg");
	t.assert.strictEqual(warnings.length, 0);
});

test("#2448: No warning when a Nunjucks permalink renders before other computed data resolves", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addTemplate("post.njk", "{{ title }}", {
				title: "front matter",
				permalink: "/posts/{{ page.fileSlug }}/",
				eleventyComputed: {
					title: (data) => `computed ${data.title}`,
					label: "{{ title }}!",
				},
			});
		},
	});
	let warnings = captureWarnings(elev);

	let [result] = await elev.toJSON();
	t.assert.strictEqual(result.url, "/posts/post/");
	t.assert.strictEqual(result.content, "computed front matter");
	t.assert.strictEqual(warnings.length, 0);
});

test("#2448: Early read warnings are verbose-only (debug output in quiet mode)", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addPreprocessor("check", "njk", (data) => {
				data.title;
			});
			eleventyConfig.addTemplate("lazy.njk", "{{ title }}", {
				title: "front matter",
				eleventyComputed: { title: () => "computed" },
			});
		},
	});
	let warnings = captureWarnings(elev);
	elev.setIsVerbose(false);

	await elev.toJSON();
	t.assert.strictEqual(warnings.length, 0);
});
