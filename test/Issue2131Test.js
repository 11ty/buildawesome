import test from "node:test";
import Eleventy from "../src/Core.js";

test("#2131: Markdown computed data finds variables in untaken Liquid branches", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config(eleventyConfig) {
			eleventyConfig.addGlobalData("eleventyComputed", {
				var: "foo",
				test: "{% if test %}{{ test }}{% else %}{{ var }}{% endif %}",
				permalink: "{{ test }}/{{ page.fileSlug }}/",
			});
			eleventyConfig.addTemplate("page.md", "{{ test }}");
		},
	});

	let [result] = await elev.toJSON();
	t.assert.strictEqual(result.url, "/foo/page/");
	t.assert.strictEqual(result.content.trim(), "<p>foo</p>");
});

test("#2131: Computed data symbols use the templateEngineOverride engine", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config(eleventyConfig) {
			eleventyConfig.addGlobalData("eleventyComputed", {
				var: "foo",
				// `unless` is Liquid-only syntax
				test: "{% unless test %}{{ var }}{% endunless %}{{ test }}",
				permalink: "{{ test }}/{{ page.fileSlug }}/",
			});
			eleventyConfig.addTemplate("page.njk", "{{ test }}", {
				templateEngineOverride: "liquid",
			});
		},
	});

	let [result] = await elev.toJSON();
	t.assert.strictEqual(result.url, "/foo/page/");
	t.assert.strictEqual(result.content, "foo");
});
