import test from "node:test";
import Eleventy from "../src/Core.js";

async function getResults(configCallback) {
	let warnings = [];
	let elev = new Eleventy("test/noop", false, {
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
	t.assert.ok(warnings[0].includes("setPermalinkCollapseMatchingFolder"));
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
