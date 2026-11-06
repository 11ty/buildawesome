import test from "node:test";

import { defineConfig } from "../src/Core.js";

test("defineConfig returns its callback unchanged", (t) => {
	let callback = function (eleventyConfig) {};
	t.assert.strictEqual(defineConfig(callback), callback);
});
