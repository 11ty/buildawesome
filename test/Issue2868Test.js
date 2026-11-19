import test from "node:test";
import Eleventy from "../src/Core.js";

// Directory data files can’t be virtual, so only those live in test/stubs-2868
async function getResults(freezeGlobalData) {
	let elev = new Eleventy("test/stubs-2868", false, {
		config($config) {
			$config.setFreezeGlobalData(freezeGlobalData);
			$config.addGlobalData("data", { key1: "global", sub: { a: "global" } });

			for (let dir of ["a", "b/c", "d/e", "f"]) {
				$config.addTemplate(`${dir}/index.11ty.js`, {
					render: ({ data }) => JSON.stringify(data),
				});
			}
		},
	});
	let results = await elev.toJSON();
	return Object.fromEntries(results.map(({ url, content }) => [url, JSON.parse(content)]));
}

for (let freezeGlobalData of [true, false]) {
	test(`#2868 \`override:\` in directory data files (freezeGlobalData: ${freezeGlobalData})`, async (t) => {
		let results = await getResults(freezeGlobalData);

		// Replaces global data
		t.assert.deepStrictEqual(results["/a/"], { key2: "a" });
		// Child override replaces parent directory data too
		t.assert.deepStrictEqual(results["/b/c/"], { key3: "c" });
		// Child directory data merges into parent override
		t.assert.deepStrictEqual(results["/d/e/"], { key2: "d", key3: "e" });
		// Nested override
		t.assert.deepStrictEqual(results["/f/"], { key1: "global", sub: { b: "f" } });
	});
}
