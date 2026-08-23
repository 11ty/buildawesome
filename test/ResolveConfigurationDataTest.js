import test from "ava";

import { ResolveConfigurationData } from "../src/Data/ResolveConfigurationData.js";

test("Alternate location", (t) => {
  t.is(ResolveConfigurationData.getAlternatePropertyName("permalink"), undefined);
  t.is(ResolveConfigurationData.getAlternatePropertyName("eleventyComputed"), undefined);
  t.is(ResolveConfigurationData.getAlternatePropertyName("buildawesomeComputed"), "eleventyComputed");
  t.is(ResolveConfigurationData.getAlternatePropertyName("buildawesomeDataSchema"), "eleventyDataSchema");
  t.is(ResolveConfigurationData.getAlternatePropertyName("buildawesomeExcludeFromCollections"), "eleventyExcludeFromCollections");
});

test("Permalink (empty data)", (t) => {
	let data = {};
	t.is(ResolveConfigurationData.getValue(data, "permalink"), undefined);
});

test("Permalink", (t) => {
	let data = { permalink: "test" };
	t.is(ResolveConfigurationData.getValue(data, "permalink"), "test");
});

test("Computed Data", (t) => {
	let data = { eleventyComputed: { key: "value" } };
	t.deepEqual(ResolveConfigurationData.getValue(data, "eleventyComputed"), { key: "value" });
});

test("Computed Data, alternate location", (t) => {
	let data = { eleventyComputed: { key: "value1" } };
	t.deepEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), { key: "value1" });
});

test("Both locations exist, no alternate", (t) => {
	let data = {
		eleventyComputed: { key1: "value1" },
		buildawesomeComputed: { key2: "value2" },
	};

	t.deepEqual(ResolveConfigurationData.getValue(data, "eleventyComputed"), { key1: "value1" });
});

test("Both locations exist, no merge (number)", (t) => {
	let data = {
		eleventyComputed: 123,
		buildawesomeComputed: 456,
	};

	t.deepEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), 456);
});

test("Both locations exist, no merge (string)", (t) => {
	let data = {
		eleventyComputed: "123",
		buildawesomeComputed: "456",
	};

	t.deepEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), "456");
});

test("Both locations exist, no merge (boolean)", (t) => {
	let data = {
		eleventyComputed: true,
		buildawesomeComputed: false,
	};

	t.deepEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), false);
});

test("Both locations exist, merge Object", (t) => {
	let data = {
		eleventyComputed: { key1: "value1" },
		buildawesomeComputed: { key2: "value2" },
	};

	t.deepEqual(ResolveConfigurationData.getValue(data, "buildawesomeComputed"), { key1: "value1", key2: "value2" });
});

test("Both locations exist, merge Array", (t) => {
	let data = {
		eleventyExcludeFromCollections: ["one"],
		buildawesomeExcludeFromCollections: ["two"],
	};

	t.deepEqual(ResolveConfigurationData.getValue(data, "buildawesomeExcludeFromCollections"), ["two", "one"]);
});
