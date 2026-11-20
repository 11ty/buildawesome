import test from "node:test";
import Eleventy from "../src/Core.js";
import { TemplateQueryRegistry } from "../src/Util/TemplateQuery.js";

const DISABLED = /Collections are disabled via `\$config\.configureFeatures\(\{ collections: false \}\)`/;

function getEleventy(templates, configCallback) {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config($config) {
			$config.configureFeatures({ collections: false });
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

// Walks the `cause` chain
function hasDisabledError(e) {
	for (let err = e; err; err = err.cause || err.originalError) {
		if (DISABLED.test(err.message)) {
			return true;
		}
	}
	return false;
}

const SITE = [
	["a.md", "# A", { tags: ["post"] }],
	["b.njk", "B", { tags: ["post", "Post"] }],
	[
		"paged.njk",
		"{{ item }}",
		{
			tags: "paged",
			items: [1, 2, 3],
			pagination: { data: "items", size: 1, alias: "item", addAllPagesToCollections: true },
			permalink: "/paged/{{ item }}/",
		},
	],
	["liquid.liquid", "{{ page.url }}"],
	["script.11ty.js", (data) => data.page.url],
];

test("Disabled: site with tags and pagination builds, nothing is collected", async (t) => {
	let elev = getEleventy(SITE);
	let results = byUrl(await elev.toJSON());

	t.assert.strictEqual(results["/a/"], "<h1>A</h1>");
	t.assert.strictEqual(results["/b/"], "B");
	t.assert.strictEqual(results["/paged/1/"], "1");
	t.assert.strictEqual(results["/paged/3/"], "3");
	t.assert.strictEqual(results["/liquid/"], "/liquid/");
	t.assert.strictEqual(results["/script/"], "/script/");

	let templateMap = elev.writer.templateMap;
	t.assert.strictEqual(templateMap.collection.getAll().length, 0);
	t.assert.deepStrictEqual(templateMap.collectionsData, {});

	let [first, second] = templateMap.getMap();
	t.assert.strictEqual(first.data.collections, second.data.collections);
	t.assert.throws(() => first.data.collections.all, DISABLED);
});

test("Disabled: works alongside `keys.tags: false`", async (t) => {
	let results = byUrl(
		await getEleventyWithConfig(SITE, ($config) => {
			$config.configureFeatures({ collections: false });
			return { keys: { tags: false } };
		}).toJSON(),
	);
	t.assert.strictEqual(results["/a/"], "<h1>A</h1>");
	t.assert.strictEqual(results["/paged/2/"], "2");
});

function getEleventyWithConfig(templates, callback) {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config($config) {
			for (let [name, content, data] of templates) {
				$config.addTemplate(name, content, data);
			}
			return callback($config);
		},
	});
	elev.disableLogger();
	return elev;
}

for (let [name, content] of [
	["index.njk", "{{ collections.all.length }}"],
	["index.liquid", "{{ collections.all.size }}"],
	["index.11ty.js", (data) => data.collections.all.length],
	["index.md", "{{ collections.all | getPreviousCollectionItem }}"],
]) {
	test(`Disabled: reading collections.all throws (${name})`, async (t) => {
		let elev = getEleventy([[name, content]]);
		await t.assert.rejects(() => elev.toJSON(), hasDisabledError);
	});
}

test("Disabled: computed data reading collections throws", async (t) => {
	let elev = getEleventy([
		[
			"index.njk",
			"{{ count }}",
			{ buildawesomeComputed: { count: (data) => data.collections.all.length } },
		],
	]);
	await t.assert.rejects(() => elev.toJSON(), hasDisabledError);
});

test("Disabled: addCollection throws, regardless of call order", async (t) => {
	let before = new Eleventy("./test/stubs-virtual-nowrite", undefined, {
		config($config) {
			$config.addCollection("custom", (api) => api.getAll());
			$config.configureFeatures({ collections: false });
		},
	});
	before.disableLogger();
	await t.assert.rejects(() => before.toJSON(), hasDisabledError);

	let after = getEleventy([], ($config) => {
		$config.addCollection("custom", (api) => api.getAll());
	});
	await t.assert.rejects(() => after.toJSON(), hasDisabledError);
});

test("Disabled: setPrecompiledCollections throws", async (t) => {
	let elev = getEleventy([], ($config) => {
		$config.setPrecompiledCollections({ all: [] });
	});
	await t.assert.rejects(() => elev.toJSON(), hasDisabledError);
});

test("Disabled: paginating over collections throws", async (t) => {
	let elev = getEleventy([
		["a.md", "# A", { tags: "post" }],
		["paged.njk", "", { pagination: { data: "collections.post", size: 1 } }],
	]);
	await t.assert.rejects(
		() => elev.toJSON(),
		(e) => hasDisabledError(e) && /paged\.njk/.test(e.message),
	);
});

test("Disabled: buildawesomeImport.collections throws", async (t) => {
	let elev = getEleventy([
		["a.md", "# A", { tags: "post" }],
		["index.njk", "", { buildawesomeImport: { collections: ["post"] } }],
	]);
	await t.assert.rejects(
		() => elev.toJSON(),
		(e) => hasDisabledError(e) && /index\.njk/.test(e.message),
	);
});

for (let method of ["query", "queryAll"]) {
	test(`Disabled: collections.${method}() in front matter throws`, async (t) => {
		let elev = getEleventy(
			[
				["z.njk", "Z"],
				[
					"a.njk",
					`---js
const target = collections.${method}("z.njk");
---
A`,
				],
			],
			($config) => {
				$config.addExperimentalBehavior(TemplateQueryRegistry.FLAGS.QUERY);
			},
		);
		await t.assert.rejects(() => elev.toJSON(), hasDisabledError);
	});
}

test("Enabled (default): collections are populated", async (t) => {
	let elev = getEleventyWithConfig(
		[
			["a.md", "# A", { tags: "post" }],
			["index.njk", "{{ collections.post.length }}/{{ collections.all.length }}"],
		],
		() => {},
	);
	let results = byUrl(await elev.toJSON());
	t.assert.strictEqual(results["/"], "1/2");
});

test("configureFeatures rejects unknown features and non-boolean values", async (t) => {
	for (let features of [{ nope: false }, { collections: "no" }]) {
		let elev = new Eleventy("./test/stubs-virtual-nowrite", undefined, {
			config($config) {
				$config.configureFeatures(features);
			},
		});
		elev.disableLogger();
		await t.assert.rejects(
			() => elev.toJSON(),
			(e) => /configureFeatures/.test(e.message) || /configureFeatures/.test(e.cause?.message),
		);
	}
});
