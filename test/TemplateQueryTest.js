import test from "node:test";
import Eleventy from "../src/Core.js";

function getEleventy(templates, configCallback) {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config($config) {
			for (let [name, content, data] of templates) {
				$config.addTemplate(name, content, data);
			}
			configCallback?.($config);
		},
	});
	elev.disableLogger();
	return elev;
}

function byUrl(results) {
	return Object.fromEntries(results.map((entry) => [entry.url, entry.content.trim()]));
}

test("query() in JavaScript front matter returns a template that renders first", async (t) => {
	// Without the dependency, the slower front matter here would put `z.njk` last
	let elev = getEleventy([
		[
			"a.md",
			`---js
const target = collections.query("z.njk");
---
[{{ target.content }}|{{ target.url }}|{{ target.data.title }}]`,
		],
		[
			"z.njk",
			`---js
await new Promise((resolve) => setTimeout(resolve, 50));
const title = "Zed";
---
<b>Hello</b>`,
		],
	]);

	let results = byUrl(await elev.toJSON());
	t.assert.strictEqual(results["/a/"], `<p>[<b>Hello</b>|/z/|Zed]</p>`);

	let order = elev.eleventyConfig.usesGraph.getTemplateOrder();
	t.assert.ok(
		order.indexOf("test/stubs-virtual-nowrite/z.njk") <
			order.indexOf("test/stubs-virtual-nowrite/a.md"),
	);
});

test("queryAll() supports globs", async (t) => {
	let elev = getEleventy([
		[
			"posts/index.njk",
			`---js
const posts = collections.queryAll("*.md");
---
{{ posts.length }}:{% for post in posts %}{{ post.data.title }},{% endfor %}`,
		],
		["posts/one.md", `---\ntitle: One\n---\nOne`],
		["posts/two.md", `---\ntitle: Two\n---\nTwo`],
		["other.md", `---\ntitle: Other\n---\nOther`],
	]);

	let results = byUrl(await elev.toJSON());
	t.assert.strictEqual(results["/posts/"], "2:One,Two,");
});

test("queryAll() content works in Liquid loops", async (t) => {
	let elev = getEleventy([
		[
			"index.liquid",
			`---js
const posts = collections.queryAll(["posts/*.md"]);
---
{% for post in posts %}{{ post.content }}{% endfor %}`,
		],
		["posts/one.md", `One`],
		["posts/two.md", `Two`],
	]);

	let results = byUrl(await elev.toJSON());
	t.assert.strictEqual(results["/"], "<p>One</p>\n<p>Two</p>");
});

test("query() finds templates excluded from collections", async (t) => {
	let elev = getEleventy([
		[
			"a.njk",
			`---js
const target = collections.query("hidden.md");
---
{{ target.content | safe }}`,
		],
		["hidden.md", `---\neleventyExcludeFromCollections: true\n---\nHidden`],
	]);

	let results = byUrl(await elev.toJSON());
	t.assert.strictEqual(results["/a/"], "<p>Hidden</p>");
});

test("query() that matches nothing throws", async (t) => {
	let elev = getEleventy([
		[
			"a.njk",
			`---js
const target = collections.query("missing.md");
---
{{ target.content }}`,
		],
	]);

	await t.assert.rejects(elev.toJSON(), (error) => {
		let message = `${error.message} ${error.cause?.message || ""}`;
		return message.includes("did not match a template");
	});
});

test("Paths are relative to the calling file, and a leading `/` is the input directory", async (t) => {
	let elev = getEleventy([
		[
			"blog/index.njk",
			`---js
const sibling = collections.query("post.md");
const fromRoot = collections.query("/about.md");
const notes = collections.queryAll("/notes/*.md");
---
{{ sibling.data.title }}|{{ fromRoot.data.title }}|{{ notes.length }}`,
		],
		["blog/post.md", `---\ntitle: Post\n---\nPost`],
		["about.md", `---\ntitle: About\n---\nAbout`],
		["notes/one.md", `One`],
		["notes/two.md", `Two`],
	]);

	let results = byUrl(await elev.toJSON());
	t.assert.strictEqual(results["/blog/"], "Post|About|2");
});

test("Templates sharing a queryAll() glob each get their own Array, including themselves", async (t) => {
	let arrays = new Set();
	let template = `---js
const posts = collections.queryAll("*.md");
---
{{ posts | track }}{% assign sorted = posts | sort: "url" %}{% for post in sorted %}{{ post.url }}{% endfor %}`;
	let elev = getEleventy(
		[
			["posts/a.md", template],
			["posts/b.md", template],
			["posts/c.md", template],
		],
		($config) => {
			$config.addFilter("track", (value) => {
				arrays.add(value);
				return "";
			});
		},
	);

	let results = byUrl(await elev.toJSON());
	for (let url of ["/posts/a/", "/posts/b/", "/posts/c/"]) {
		t.assert.strictEqual(results[url], "<p>/posts/a//posts/b//posts/c/</p>");
	}
	t.assert.strictEqual(arrays.size, 3);
});

test("query() can return the calling template, but not its content", async (t) => {
	let elev = getEleventy([
		[
			"a.njk",
			`---js
const self = collections.query("a.njk");
---
{{ self.url }}`,
		],
		[
			"b.njk",
			`---js
const self = collections.query("b.njk");
---
{{ self.content }}`,
		],
	]);

	await t.assert.rejects(elev.toJSON(), (error) => {
		let message = `${error.message} ${error.cause?.message || ""}`;
		return message.includes("b.njk") && message.includes("circular");
	});

	let selfOnly = getEleventy([
		[
			"a.njk",
			`---js
const self = collections.query("a.njk");
---
{{ self.url }}`,
		],
	]);
	let results = byUrl(await selfOnly.toJSON());
	t.assert.strictEqual(results["/a/"], "/a/");
});

test("queryAll() returns an Array", async (t) => {
	let elev = getEleventy(
		[
			[
				"index.njk",
				`---js
const posts = collections.queryAll("posts/*.md");
---
{{ posts | isArray }}:{{ posts | join(",") | length > 0 }}`,
			],
			["posts/one.md", `One`],
		],
		($config) => {
			$config.addFilter("isArray", (value) => Array.isArray(value));
		},
	);

	let results = byUrl(await elev.toJSON());
	t.assert.strictEqual(results["/"], "true:true");
});

test("Pagination works over queryAll() results", async (t) => {
	let elev = getEleventy([
		[
			"index.njk",
			`---js
const posts = collections.queryAll("posts/*.md");
const pagination = { data: "posts", size: 1, alias: "post" };
const permalink = "/page-{{ pagination.pageNumber }}/";
---
{{ post.url }}`,
		],
		["posts/one.md", `One`],
		["posts/two.md", `Two`],
	]);

	let results = byUrl(await elev.toJSON());
	t.assert.deepStrictEqual(Object.keys(results).filter((url) => url.startsWith("/page-")).sort(), [
		"/page-0/",
		"/page-1/",
	]);
	t.assert.deepStrictEqual([results["/page-0/"], results["/page-1/"]].sort(), [
		"/posts/one/",
		"/posts/two/",
	]);
});

test("Array methods called on queryAll() in front matter apply once results exist", async (t) => {
	let elev = getEleventy([
		[
			"index.njk",
			`---js
const posts = collections.queryAll("posts/*.md").sort((a, b) => b.data.order - a.data.order);
const titles = collections.queryAll("posts/*.md")
	.filter((post) => post.data.order > 1)
	.map((post) => post.data.title);
const reversed = collections.queryAll("posts/*.md").sort((a, b) => a.data.order - b.data.order).reverse();
---
{% for post in posts %}{{ post.data.title }},{% endfor %}|{{ titles | join(",") }}|{{ reversed[0].data.title }}`,
		],
		["posts/a.md", `---\ntitle: A\norder: 1\n---\nA`],
		["posts/b.md", `---\ntitle: B\norder: 3\n---\nB`],
		["posts/c.md", `---\ntitle: C\norder: 2\n---\nC`],
	]);

	let results = byUrl(await elev.toJSON());
	let [sorted, titles, last] = results["/"].split("|");
	t.assert.strictEqual(sorted, "B,C,A,");
	t.assert.deepStrictEqual(titles.split(",").sort(), ["B", "C"]);
	t.assert.strictEqual(last, "B");
});

test("Destructuring query() in front matter resolves once results exist", async (t) => {
	let elev = getEleventy([
		[
			"blog/index.njk",
			`---js
const posts = collections.queryAll("*.md");
const { data: about } = collections.query("/about.md");
const { url: aboutUrl } = collections.query("/about.md");
---
<p>{{ about.summary }} <a href="{{ about.page.url }}">More</a> {{ aboutUrl }}</p>`,
		],
		["about.md", `---\nsummary: Hi there.\n---\nAbout`],
		["blog/post.md", `Post`],
	]);

	let results = byUrl(await elev.toJSON());
	t.assert.strictEqual(results["/blog/"], `<p>Hi there. <a href="/about/">More</a> /about/</p>`);
});
