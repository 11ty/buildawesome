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

test("#4182 addCollection warns when a template that imports it publishes to its tag", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addCollection("nav", (collectionApi) => {
				return collectionApi.getFilteredByTag("primary");
			});

			eleventyConfig.addTemplate("page.liquid", "{{ collections.nav.length }}", {
				tags: ["primary"],
				eleventyImport: {
					collections: ["nav"],
				},
			});
		},
	});
	let warnings = captureWarnings(elev);

	let [result] = await elev.toJSON();
	t.assert.strictEqual(result.content, "0");
	t.assert.strictEqual(warnings.length, 1);
	t.assert.strictEqual(warnings[0].includes("`collections.nav`"), true);
	t.assert.strictEqual(warnings[0].includes("{ defer: true }"), true);
});

test("#4182 addCollection does not warn for templates that paginate over it or over collections", async (t) => {
	let runs = 0;
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addCollection("posts", (collectionApi) => {
				runs++;
				return collectionApi.getAll().filter((item) => item.data.tags?.includes("post"));
			});

			eleventyConfig.addTemplate("post1.md", "Post", { tags: ["post"] });
			eleventyConfig.addTemplate("post2.md", "Post", { tags: ["post"] });
			eleventyConfig.addTemplate("feed.liquid", "{{ pagination.items.length }}", {
				pagination: { data: "collections.posts", size: 10 },
				permalink: "/feed/",
			});
			eleventyConfig.addTemplate("tag.liquid", "{{ name }}", {
				pagination: { data: "collections", size: 1, alias: "name" },
				permalink: "/tags/{{ name }}/",
			});
		},
	});
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(results.find((entry) => entry.url === "/feed/")?.content, "2");
	t.assert.strictEqual(runs, 1);
	t.assert.deepStrictEqual(warnings, []);
});

test("#4182 addCollection with defer runs once, after templates are added", async (t) => {
	let runs = 0;
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addCollection(
				"nav",
				(collectionApi) => {
					runs++;
					return collectionApi.getFilteredByTag("primary");
				},
				{ defer: true },
			);

			eleventyConfig.addTemplate("page.liquid", "{{ collections.nav.length }}", {
				tags: ["primary"],
				eleventyImport: {
					collections: ["nav"],
				},
			});
		},
	});

	let [result] = await elev.toJSON();
	t.assert.strictEqual(result.content, "1");
	t.assert.strictEqual(runs, 1);
});

test("#4182 pagination over a deferred addCollection warns and ignores defer", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addCollection(
				"nav",
				(collectionApi) => collectionApi.getFilteredByTag("primary"),
				{ defer: true },
			);

			eleventyConfig.addTemplate("one.liquid", "One", { tags: ["primary"] });
			eleventyConfig.addTemplate("two.liquid", "Two", { tags: ["primary"] });
			eleventyConfig.addTemplate("list.liquid", "{{ pagination.items.length }}", {
				pagination: {
					data: "collections.nav",
					size: 10,
				},
				permalink: "/list/",
			});
		},
	});
	let warnings = captureWarnings(elev);

	let results = await elev.toJSON();
	t.assert.strictEqual(results.find((entry) => entry.url === "/list/")?.content, "2");
	t.assert.strictEqual(warnings.length, 1);
	t.assert.strictEqual(warnings[0].includes("`defer: true` was ignored for `collections.nav`"), true);
});

test("#4182 deferred addCollection runs before templates that paginate over collections", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addCollection(
				"nav",
				(collectionApi) => collectionApi.getFilteredByTag("primary"),
				{ defer: true },
			);

			eleventyConfig.addTemplate("page.liquid", "{{ collections.nav.length }}", {
				tags: ["primary"],
				eleventyImport: {
					collections: ["nav"],
				},
			});

			eleventyConfig.addTemplate("collection.liquid", "{{ collections[name].length }}", {
				pagination: {
					data: "collections",
					size: 1,
					alias: "name",
				},
				permalink: "/{{ name }}/",
			});
		},
	});

	let results = await elev.toJSON();
	t.assert.strictEqual(results.find((entry) => entry.url === "/nav/")?.content, "1");
});
