import test from "node:test";
import Eleventy from "../src/Core.js";
import { RenderPlugin } from "../src/Plugins/RenderPlugin.js";

async function getResults(configCallback, options = {}) {
	let warnings = [];
	let elev = new Eleventy("test/noop", false, {
		...options,
		config($config) {
			$config.addTemplate("2025/08/08.md", "a");
			$config.addTemplate("2025/08/09.md", "b");
			$config.addTemplate("2025/08/data.json.njk", "d");
			configCallback?.($config);
		},
	});
	elev.logger.overrideLogger({
		log() {},
		info() {},
		error() {},
		warn(message) {
			warnings.push(message);
		},
	});

	let results = await elev.toJSON();
	let urls = Object.fromEntries(results.map((entry) => [entry.inputPath, entry.url]));
	return { urls, warnings };
}

test("#3919 File names matching their parent folder are not collapsed (and warn)", async (t) => {
	let { urls, warnings } = await getResults(($config) => {
		// Previously an output conflict with `08.md`
		$config.addTemplate("2025/08/index.md", "c");
	});
	t.assert.strictEqual(urls["./test/noop/2025/08/08.md"], "/2025/08/08/");
	t.assert.strictEqual(urls["./test/noop/2025/08/09.md"], "/2025/08/09/");
	t.assert.strictEqual(urls["./test/noop/2025/08/index.md"], "/2025/08/");
	t.assert.strictEqual(warnings.length, 1);
	t.assert.ok(warnings[0].includes("./test/noop/2025/08/08.md"));
	t.assert.ok(warnings[0].includes("now outputs to `/2025/08/08/`"));
	t.assert.ok(warnings[0].includes("v3 output it to `/2025/08/`"));
	t.assert.ok(warnings[0].includes("rename it to `index.md`"));
	t.assert.ok(warnings[0].includes("setPermalinkCollapseMatchingFolder"));
});

test("#3919 Warns once with computed data reading `page.url`", async (t) => {
	let { urls, warnings } = await getResults(($config) => {
		$config.addTemplate("blog/blog.md", "{{ pageUrl }}", {
			eleventyComputed: { pageUrl: (data) => data.page.url },
		});
	});
	t.assert.strictEqual(urls["./test/noop/blog/blog.md"], "/blog/blog/");
	let blogWarnings = warnings.filter((w) => w.includes("./test/noop/blog/blog.md"));
	t.assert.strictEqual(blogWarnings.length, 1);
	t.assert.ok(blogWarnings[0].includes("now outputs to `/blog/blog/`"));
	t.assert.ok(blogWarnings[0].includes("v3 output it to `/blog/`"));
});

test("#3919 Front matter permalink with computed data reading `page.url` does not warn", async (t) => {
	let { urls, warnings } = await getResults(($config) => {
		$config.addTemplate("blog/blog.md", "{{ pageUrl }}", {
			permalink: "/blog/",
			eleventyComputed: { pageUrl: (data) => data.page.url },
		});
	});
	t.assert.strictEqual(urls["./test/noop/blog/blog.md"], "/blog/");
	t.assert.ok(!warnings.some((w) => w.includes("./test/noop/blog/blog.md")));
});

test("#3919 Directory data permalink does not warn", async (t) => {
	let warnings = [];
	let elev = new Eleventy("test/stubs-3919", false);
	elev.logger.overrideLogger({
		log() {},
		info() {},
		error() {},
		warn(message) {
			warnings.push(message);
		},
	});
	let [result] = await elev.toJSON();
	t.assert.strictEqual(result.url, "/blog/blog/");
	t.assert.deepStrictEqual(warnings, []);
});

test("#3919 RenderPlugin content does not warn", async (t) => {
	let { urls, warnings } = await getResults(($config) => {
		$config.addPlugin(RenderPlugin);
		$config.addTemplate(
			"blog/blog.njk",
			`{% renderTemplate "njk" %}{{ page.url }}{% endrenderTemplate %}`,
			{ permalink: "/blog/" },
		);
	});
	t.assert.strictEqual(urls["./test/noop/blog/blog.njk"], "/blog/");
	t.assert.ok(!warnings.some((w) => w.includes("./test/noop/blog/blog.njk")));
});

test("#3919 setPermalinkCollapseMatchingFolder(true) restores old behavior", async (t) => {
	let { urls, warnings } = await getResults(($config) => {
		$config.addTemplate("other/08.md", "e");
		$config.setPermalinkCollapseMatchingFolder(true);
	});
	t.assert.strictEqual(urls["./test/noop/2025/08/08.md"], "/2025/08/");
	t.assert.strictEqual(urls["./test/noop/other/08.md"], "/other/08/");
	t.assert.deepStrictEqual(warnings, []);
});

test("#3919 configureErrorReporting({ collapsedMatchingFolder: 'allow' }) silences the warning", async (t) => {
	let { urls, warnings } = await getResults(($config) => {
		$config.configureErrorReporting({ collapsedMatchingFolder: "allow" });
	});
	t.assert.strictEqual(urls["./test/noop/2025/08/08.md"], "/2025/08/08/");
	t.assert.deepStrictEqual(warnings, []);
});

test("#3919 Explicit permalinks do not warn", async (t) => {
	let { warnings } = await getResults(($config) => {
		$config.addGlobalData("permalink", () => (data) => `${data.page.filePathStem}/index.html`);
	});
	t.assert.deepStrictEqual(warnings, []);
});

test("#3919 the warning breaks through quiet mode", async (t) => {
	let { urls, warnings } = await getResults(undefined, { quietMode: true });
	t.assert.strictEqual(urls["./test/noop/2025/08/08.md"], "/2025/08/08/");
	t.assert.strictEqual(warnings.length, 1);
	t.assert.ok(warnings[0].includes("setPermalinkCollapseMatchingFolder"));
});
