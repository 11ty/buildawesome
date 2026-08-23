// This test file is using Node’s test runner because `tsx` doesn’t work with worker threads (used by avajs)
// See https://github.com/privatenumber/tsx/issues/354
// See https://github.com/nodejs/node/issues/47747
import test from "node:test";
import assert from "node:assert";
import module from "node:module";
import { renderToStaticMarkup } from "react-dom/server";

import Eleventy from "../src/Core.js";

import { load } from "./mdx-hooks.js";
if ("registerHooks" in module) {
	module.registerHooks({ load });
}

test("Eleventy with MDX", async () => {
	let elev = new Eleventy("./test/stubs-fancyjs/test.mdx", undefined, {
		config: (eleventyConfig) => {
			eleventyConfig.addExtension("mdx", {
				key: "11ty.js",
				compile: () => {
					return async function (data) {
						let content = await this.defaultRenderer(data);
						return renderToStaticMarkup(content);
					};
				},
			});
		},
	});
	elev.disableLogger();
	elev.setFormats("mdx");

	let results = await elev.toJSON();
	assert.strictEqual(results.length, 1);

	assert.strictEqual(results[0].content, `<h1>Hello, World!!!!</h1>`);
});
