import test from "ava";
import path from "node:path";
import Eleventy from "../src/Core.js";
import PathNormalizer from "../src/Util/PathNormalizer.js";

function addMarkdownAlternate(eleventyConfig) {
	eleventyConfig.addTemplate(
		"markdown-alt.11ty.js",
		function ({ source }) {
			return source.contentPipeline.md;
		},
		{
			pagination: {
				data: "collections.all",
				size: 1,
				alias: "source",
				before: (items) =>
					items.filter(
						(item) =>
							item.inputPath.endsWith(".md") &&
							String(item.outputPath).endsWith(".html") &&
							!item.data.pagination,
					),
			},
			permalink: ({ source, eleventy }) =>
				PathNormalizer.normalizeSeperator(
					path.relative(eleventy.directories.output, source.outputPath),
				).replace(/(\/index)?\.html$/, ".md"),
			eleventyExcludeFromCollections: true,
			layout: false,
		},
	);
}

function getByUrl(results, url) {
	return results.find((entry) => entry.url === url)?.content;
}

test("contentPipeline.md with Liquid preprocessing (default)", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			addMarkdownAlternate(eleventyConfig);
			eleventyConfig.addTemplate("about.md", `# {{ title }}\n\n{% if true %}Liquid ran{% endif %}`, {
				title: "About",
			});
		},
	});

	let results = await elev.toJSON();
	t.is(getByUrl(results, "/about/").trim(), "<h1>About</h1>\n<p>Liquid ran</p>");
	t.is(getByUrl(results, "/about.md"), "# About\n\nLiquid ran");
});

test("contentPipeline.md with Nunjucks preprocessing", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			eleventyConfig.setMarkdownTemplateEngine("njk");
			addMarkdownAlternate(eleventyConfig);
			eleventyConfig.addTemplate("about.md", `# {{ title | upper }}\n\n{% set x = 2 %}{{ x * 2 }}`, {
				title: "About",
			});
		},
	});

	let results = await elev.toJSON();
	t.is(getByUrl(results, "/about.md"), "# ABOUT\n\n4");
});

test("contentPipeline.md with `templateEngineOverride: njk,md` on a Markdown file", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			addMarkdownAlternate(eleventyConfig);
			eleventyConfig.addTemplate("about.md", `# {{ title | upper }}`, {
				title: "About",
				templateEngineOverride: "njk,md",
			});
		},
	});

	let results = await elev.toJSON();
	t.is(getByUrl(results, "/about.md"), "# ABOUT");
});

test("contentPipeline.md with `templateEngineOverride: md` is the raw input", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			addMarkdownAlternate(eleventyConfig);
			eleventyConfig.addTemplate("about.md", `# {{ title }}`, {
				title: "About",
				templateEngineOverride: "md",
			});
		},
	});

	let results = await elev.toJSON();
	t.is(getByUrl(results, "/about.md"), "# {{ title }}");
});

test("contentPipeline.md with `markdownTemplateEngine: false` is the raw input", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			eleventyConfig.setMarkdownTemplateEngine(false);
			addMarkdownAlternate(eleventyConfig);
			eleventyConfig.addTemplate("about.md", `# {{ title }}`, { title: "About" });
		},
	});

	let results = await elev.toJSON();
	t.is(getByUrl(results, "/about.md"), "# {{ title }}");
});

test("contentPipeline.md is undefined for templates that don’t use Markdown", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			eleventyConfig.addTemplate("page.njk", `{{ title }}`, { title: "Nunjucks" });
			eleventyConfig.addTemplate("override.md", `{{ title }}`, {
				title: "Override",
				templateEngineOverride: "njk",
			});
			eleventyConfig.addTemplate(
				"report.11ty.js",
				function ({ collections }) {
					return JSON.stringify(
						collections.all.map((item) => [item.url, item.contentPipeline.md ?? null]),
					);
				},
				{ eleventyExcludeFromCollections: true },
			);
		},
	});

	let results = await elev.toJSON();
	t.deepEqual(JSON.parse(getByUrl(results, "/report/")).sort(), [
		["/override/", null],
		["/page/", null],
	]);
});

test("Shortcodes see the source page and run once per page", async (t) => {
	let calls = [];
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			eleventyConfig.addShortcode("pageUrl", function () {
				calls.push(this.page.url);
				return this.page.url;
			});
			addMarkdownAlternate(eleventyConfig);
			eleventyConfig.addTemplate("about.md", `Liquid {% pageUrl %}`);
			eleventyConfig.addTemplate("contact.md", `Nunjucks {% pageUrl %}`, {
				templateEngineOverride: "njk,md",
			});
		},
	});

	let results = await elev.toJSON();
	t.is(getByUrl(results, "/about.md"), "Liquid /about/");
	t.is(getByUrl(results, "/contact.md"), "Nunjucks /contact/");
	t.deepEqual(calls.sort(), ["/about/", "/contact/"]);
});

test("contentPipeline is available to a Liquid page iterating collections", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			eleventyConfig.addTemplate("about.md", `# {{ title }}`, { title: "About", tags: "pages" });
			eleventyConfig.addTemplate(
				"llms.txt.liquid",
				`{% for item in collections.pages %}{{ item.contentPipeline.md }}{% endfor %}`,
				{ permalink: "/llms.txt" },
			);
		},
	});

	let results = await elev.toJSON();
	t.is(getByUrl(results, "/llms.txt"), "# About");
});

function addReport(eleventyConfig) {
	eleventyConfig.addTemplate(
		"report.11ty.js",
		({ collections }) =>
			JSON.stringify(Object.fromEntries(collections.all.map((item) => [item.url, item.contentPipeline]))),
		{ eleventyExcludeFromCollections: true },
	);
}

test("contentPipeline has an entry for every step in the template syntax", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			addReport(eleventyConfig);
			eleventyConfig.addTemplate("md.md", "# {{ title }}", { title: "Hi" });
			eleventyConfig.addTemplate("njk-md.md", "# {{ title | upper }}", {
				title: "Hi",
				templateEngineOverride: "njk,md",
			});
			eleventyConfig.addTemplate("raw.md", "# {{ title }}", { templateEngineOverride: "md" });
			eleventyConfig.addTemplate("page.html", "<p>{{ title }}</p>", { title: "Hi" });
		},
	});

	let results = await elev.toJSON();
	t.deepEqual(JSON.parse(results.find((entry) => entry.url === "/report/").content), {
		"/md/": { liquid: "# {{ title }}", md: "# Hi" },
		"/njk-md/": { njk: "# {{ title | upper }}", md: "# HI" },
		"/raw/": { md: "# {{ title }}" },
		"/page/": { liquid: "<p>{{ title }}</p>", html: "<p>Hi</p>" },
	});
});

test("contentPipeline for a Nunjucks page is its source", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			addReport(eleventyConfig);
			eleventyConfig.addTemplate("page.njk", "{{ title }}", { title: "Hi" });
		},
	});

	let results = await elev.toJSON();
	t.deepEqual(JSON.parse(results.find((entry) => entry.url === "/report/").content), {
		"/page/": { njk: "{{ title }}" },
	});
});

test("contentPipeline is copied onto collection items that are copies of page entries", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			eleventyConfig.addCollection("copies", (api) =>
				api
					.getAll()
					.filter((item) => item.url === "/about/")
					.map(({ inputPath, url, data }) => ({ inputPath, url, data })),
			);
			eleventyConfig.addTemplate("about.md", "# {{ title }}", { title: "Hi" });
			// Layouts render after collections are populated with content
			eleventyConfig.addTemplate(
				"_includes/list.liquid",
				"{% for item in collections.copies %}{{ item.contentPipeline.md }}{% endfor %}",
			);
			eleventyConfig.addTemplate("report.liquid", "", {
				layout: "list.liquid",
				eleventyExcludeFromCollections: true,
			});
		},
	});

	let results = await elev.toJSON();
	t.is(results.find((entry) => entry.url === "/report/").content, "# Hi");
});
