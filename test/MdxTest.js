import test from "node:test";
import assert from "node:assert";
import module from "node:module";
import { renderToStaticMarkup } from "react-dom/server";

import Eleventy from "../src/Core.js";

import { load } from "./_mdxHooks.js";
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
