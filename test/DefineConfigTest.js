import test from "ava";

import { defineConfig } from "../src/Core.js";

test("defineConfig returns its callback unchanged", (t) => {
	let callback = function (eleventyConfig) {};
	t.is(defineConfig(callback), callback);
});
