import test from "ava";
import Eleventy from "../src/Core.js";

async function getResult(config, url) {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, { config });
	let results = await elev.toJSON();
	return url ? results.find((entry) => entry.url === url) : results[0];
}

test("Permalinks on `njk,md` pages render with Nunjucks", async (t) => {
	let result = await getResult((eleventyConfig) => {
		eleventyConfig.addTemplate("index.md", `# {{ "abc" | replace("b", "x") }}`, {
			templateEngineOverride: "njk,md",
			permalink: `/{{ "abc" | replace("b", "x") }}/`,
		});
	});

	t.is(result.url, "/axc/");
	t.is(result.content.trim(), "<h1>axc</h1>");
});

test("Permalinks on `md` pages render with `markdownTemplateEngine` (#446)", async (t) => {
	let result = await getResult((eleventyConfig) => {
		eleventyConfig.addTemplate("about.md", `# {{ title }}`, {
			title: "Raw",
			templateEngineOverride: "md",
			permalink: "/{{ page.fileSlug }}/",
		});
	});

	t.is(result.url, "/about/");
	t.is(result.content.trim(), "<h1>{{ title }}</h1>");
});

test("`liquid,md` override on an HTML file", async (t) => {
	let result = await getResult((eleventyConfig) => {
		eleventyConfig.addTemplate("index.html", `# {{ title }}`, {
			title: "Hi",
			templateEngineOverride: "liquid,md",
		});
	});

	t.is(result.content.trim(), "<h1>Hi</h1>");
});

test("`templateSyntax` reflects the pipeline", async (t) => {
	let syntaxes = {};
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config: (eleventyConfig) => {
			eleventyConfig.addTemplate("a.md", "", {});
			eleventyConfig.addTemplate("b.md", "", { templateEngineOverride: "njk,md" });
			eleventyConfig.addTemplate("c.md", "", { templateEngineOverride: "md" });
			eleventyConfig.addTemplate("d.html", "", {});
			eleventyConfig.addTemplate("e.njk", "", {});
			eleventyConfig.addTransform("syntax", function (content) {
				syntaxes[this.page.fileSlug] = this.page.templateSyntax;
				return content;
			});
		},
	});
	await elev.toJSON();

	t.deepEqual(syntaxes, { a: "liquid,md", b: "njk,md", c: "md", d: "liquid", e: "njk" });
});

test("A custom `md` engine receives preprocessed content", async (t) => {
	let result = await getResult((eleventyConfig) => {
		eleventyConfig.addExtension("md", {
			compile: (str) => () => `<custom>${str}</custom>`,
		});
		eleventyConfig.addTemplate("index.md", `{{ title }}`, { title: "Hi" });
	});

	t.is(result.content, "<custom>Hi</custom>");
});
