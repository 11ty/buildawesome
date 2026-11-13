import test from "node:test";

import { ResolveConfigurationData } from "../src/Data/ResolveConfigurationData.js";

test("Alternate location", (t) => {
  t.assert.strictEqual(ResolveConfigurationData.getAlternatePropertyName("permalink"), undefined);
  t.assert.strictEqual(ResolveConfigurationData.getAlternatePropertyName("eleventyComputed"), undefined);
  t.assert.strictEqual(ResolveConfigurationData.getAlternatePropertyName("buildawesomeComputed"), "eleventyComputed");
  t.assert.strictEqual(ResolveConfigurationData.getAlternatePropertyName("buildawesomeDataSchema"), "eleventyDataSchema");
  t.assert.strictEqual(ResolveConfigurationData.getAlternatePropertyName("buildawesomeExcludeFromCollections"), "eleventyExcludeFromCollections");
});

test("Permalink (empty data)", (t) => {
	let data = {};
	t.assert.strictEqual(ResolveConfigurationData.getValue(data, "permalink"), undefined);
});

test("Permalink", (t) => {
	let data = { permalink: "test" };
	t.assert.strictEqual(ResolveConfigurationData.getValue(data, "permalink"), "test");
});

test("Computed Data", (t) => {
	let data = { eleventyComputed: { key: "value" } };
	t.assert.deepStrictEqual(ResolveConfigurationData.getValue(data, "eleventyComputed"), { key: "value" });
});

test("Computed Data, alternate location", (t) => {
	let data = { eleventyComputed: { key: "value1" } };
	t.assert.deepStrictEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), { key: "value1" });
});

test("Both locations exist, no alternate", (t) => {
	let data = {
		eleventyComputed: { key1: "value1" },
		buildawesomeComputed: { key2: "value2" },
	};

	t.assert.deepStrictEqual(ResolveConfigurationData.getValue(data, "eleventyComputed"), { key1: "value1" });
});

test("Both locations exist, no merge (number)", (t) => {
	let data = {
		eleventyComputed: 123,
		buildawesomeComputed: 456,
	};

	t.assert.deepStrictEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), 456);
});

test("Both locations exist, no merge (string)", (t) => {
	let data = {
		eleventyComputed: "123",
		buildawesomeComputed: "456",
	};

	t.assert.deepStrictEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), "456");
});

test("Both locations exist, no merge (boolean)", (t) => {
	let data = {
		eleventyComputed: true,
		buildawesomeComputed: false,
	};

	t.assert.deepStrictEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), false);
});

test("Both locations exist, merge Object", (t) => {
	let data = {
		eleventyComputed: { key1: "value1" },
		buildawesomeComputed: { key2: "value2" },
	};

	t.assert.deepStrictEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), { key1: "value1", key2: "value2" });
});

test("Both locations exist, merge Array", (t) => {
	let data = {
		eleventyExcludeFromCollections: ["one"],
		buildawesomeExcludeFromCollections: ["two"],
	};

	t.assert.deepStrictEqual(ResolveConfigurationData.getValue(data, "buildawesomeExcludeFromCollections"), ["two", "one"]);
});

test("Normalize folds aliases into the buildawesome key", (t) => {
	let data = {
		eleventyComputed: { key1: "value1" },
		buildawesomeComputed: { key2: "value2" },
		eleventyExcludeFromCollections: true,
		other: 1,
	};

	t.assert.deepStrictEqual(ResolveConfigurationData.normalize(data), {
		buildawesomeComputed: { key1: "value1", key2: "value2" },
		buildawesomeExcludeFromCollections: true,
		other: 1,
	});
	t.assert.strictEqual("eleventyComputed" in data, true);
});

test("Normalize returns the same object without aliases", (t) => {
	let data = { buildawesomeComputed: {} };
	t.assert.strictEqual(ResolveConfigurationData.normalize(data), data);
});
