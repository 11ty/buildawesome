import test from "node:test";
import { inspect } from "node:util";
import Eleventy from "../src/Core.js";

function stringify(entry) {
	return JSON.stringify(entry, (key, value) => (key === "data" ? undefined : value));
}

test("#3744: `template` and `templateContent` are not enumerable on collection entries", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addShortcode("keys", (entry) => {
				let keys = Object.keys(entry);
				return ["template", "templateContent", "content"].map((key) => keys.includes(key)).join(",");
			});
			eleventyConfig.addTemplate("index.njk", "{% keys collections.all[0] %}");
		},
	});

	let [result] = await elev.toJSON();
	t.assert.strictEqual(result.content, "false,false,true");
});

test("#3744: content, templateContent and template are still readable after render", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addTemplate("index.njk", "{% for entry in collections.post %}{{ entry.content }}|{{ entry.templateContent }}|{{ entry.template.inputPath }}{% endfor %}");
			eleventyConfig.addTemplate("post.njk", "Hello", { tags: "post" });
		},
	});

	let results = await elev.toJSON();
	let index = results.find((entry) => entry.inputPath.endsWith("index.njk"));
	t.assert.strictEqual(index.content, "Hello|Hello|./test/noop/post.njk");
});

test("#3744: JSON.stringify and inspect use a placeholder for unrendered `content`", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addShortcode("serialize", (entry) => {
				let json = JSON.parse(stringify(entry));
				return `${json.content}:${json.inputPath}:${inspect(entry).includes("[Internals: content queued to be rendered later]")}`;
			});
			eleventyConfig.addTemplate("index.njk", "{% serialize collections.all[0] %}");
		},
	});

	let [result] = await elev.toJSON();
	t.assert.strictEqual(result.content, "[Internals: content queued to be rendered later]:./test/noop/index.njk:true");
});

test("#3744: JSON.stringify includes rendered `content`", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addFilter("contentJson", (entries) => {
				// Reading `content` defers this template until the entries are rendered
				entries.forEach((entry) => entry.content);
				return entries.map((entry) => JSON.parse(stringify(entry)).content).join(",");
			});
			eleventyConfig.addTemplate("index.njk", "{{ collections.post | contentJson }}");
			eleventyConfig.addTemplate("post.njk", "Hello", { tags: "post" });
		},
	});

	let results = await elev.toJSON();
	let index = results.find((entry) => entry.inputPath.endsWith("index.njk"));
	t.assert.strictEqual(index.content, "Hello");
});

test("#3744: JSON.stringify works on a whole collection", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addShortcode("serialize", (entries) => {
				let json = JSON.parse(JSON.stringify(entries));
				return json.map((entry) => `${entry.inputPath}=${entry.data.collections}`).join(",");
			});
			eleventyConfig.addTemplate("index.njk", "{% serialize collections.post %}");
			eleventyConfig.addTemplate("post.njk", "Hello", { tags: "post" });
			eleventyConfig.addTemplate("paged.njk", "Paged", {
				tags: "post",
				items: [1, 2],
				pagination: { data: "items", size: 1 },
				permalink: "/paged/{{ pagination.pageNumber }}/",
			});
		},
	});

	let results = await elev.toJSON();
	let index = results.find((entry) => entry.inputPath.endsWith("index.njk"));
	t.assert.match(index.content, /\.\/test\/noop\/post\.njk=\[Internals: collections omitted\]/);
	t.assert.match(index.content, /\.\/test\/noop\/paged\.njk=\[Internals: collections omitted\]/);
});
