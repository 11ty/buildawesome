import test from "node:test";
import Eleventy from "../src/Core.js";

async function getResults(freezeGlobalData, configCallback) {
	let elev = new Eleventy("./test/stubs-virtual/", undefined, {
		config($config) {
			$config.setFreezeGlobalData(freezeGlobalData);
			configCallback($config);
		},
	});
	elev.disableLogger();

	let results = await elev.toJSON();
	results.sort((a, b) => a.url.localeCompare(b.url));
	return { elev, results };
}

for (let freezeGlobalData of [true, false]) {
	let suffix = `(freezeGlobalData: ${freezeGlobalData})`;

	test(`#4452 Config computed data nested in a global data object ${suffix}`, async (t) => {
		let { results } = await getResults(freezeGlobalData, ($config) => {
			$config.addGlobalData("foo", { a: 1 });
			$config.addGlobalData("eleventyComputed.foo.bar", () => (data) => `value${data.foo.a}`);
			$config.addTemplate("index.liquid", "{{ foo.a }} {{ foo.bar }}");
			$config.addTemplate("two.liquid", "{{ foo.a }} {{ foo.bar }}");
		});

		t.assert.deepStrictEqual(
			results.map((entry) => entry.content),
			["1 value1", "1 value1"],
		);
	});

	test(`#4452 Front matter computed data nested in a global data object stays on its template ${suffix}`, async (t) => {
		let { results } = await getResults(freezeGlobalData, ($config) => {
			$config.addGlobalData("foo", { a: 1 });
			$config.addTemplate("index.liquid", "{{ foo.a }} {{ foo.bar }}", {
				eleventyComputed: { foo: { bar: (data) => `computed${data.foo.a}` } },
			});
			$config.addTemplate("two.liquid", "{{ foo.a }} {{ foo.bar }}");
		});

		t.assert.deepStrictEqual(
			results.map((entry) => entry.content),
			["1 computed1", "1 "],
		);
	});

	test(`#4452 Deeply nested computed data is per template ${suffix}`, async (t) => {
		let { results } = await getResults(freezeGlobalData, ($config) => {
			$config.addGlobalData("foo", { a: { b: 1 } });
			$config.addGlobalData("eleventyComputed.foo.a.c", () => (data) => data.page.url);
			$config.addTemplate("index.liquid", "{{ foo.a.b }} {{ foo.a.c }}");
			$config.addTemplate("two.liquid", "{{ foo.a.b }} {{ foo.a.c }}");
		});

		t.assert.deepStrictEqual(
			results.map((entry) => entry.content),
			["1 /", "1 /two/"],
		);
	});

	test(`#4452 Computed data nested in a global data object on paginated pages ${suffix}`, async (t) => {
		let { results } = await getResults(freezeGlobalData, ($config) => {
			$config.addGlobalData("foo", { a: 1 });
			$config.addTemplate("paged.liquid", "{{ foo.a }} {{ foo.bar }}", {
				pagination: { data: "items", size: 1, alias: "item" },
				items: ["first", "second"],
				permalink: "/{{ item }}/",
				eleventyComputed: { foo: { bar: (data) => data.item } },
			});
			$config.addTemplate("other.liquid", "{{ foo.a }} {{ foo.bar }}");
		});

		t.assert.deepStrictEqual(
			results.map((entry) => [entry.url, entry.content]),
			[
				["/first/", "1 first"],
				["/other/", "1 "],
				["/second/", "1 second"],
			],
		);
	});
}

test("#4452 Only the computed key’s ancestors are copied, the rest of global data stays shared and frozen", async (t) => {
	let { elev } = await getResults(true, ($config) => {
		$config.addGlobalData("foo", { a: { b: 1 }, shared: { c: 1 } });
		$config.addTemplate("index.liquid", "{{ foo.a.computed }}", {
			eleventyComputed: { foo: { a: { computed: () => "value" } } },
		});
		$config.addTemplate("two.liquid", "");
	});

	let [index, two] = elev.writer.templateMap
		.getMap()
		.sort((a, b) => a.inputPath.localeCompare(b.inputPath));

	t.assert.strictEqual(index.data.foo.a.computed, "value");
	t.assert.strictEqual(index.data.foo.shared, two.data.foo.shared);
	t.assert.strictEqual(Object.isFrozen(index.data.foo.shared), true);
	t.assert.strictEqual(Object.isFrozen(two.data.foo), true);
	t.assert.strictEqual(Object.isFrozen(two.data.foo.a), true);
	t.assert.strictEqual("computed" in two.data.foo.a, false);
});
