export function resolvePlugin() {
	throw new Error(
		"eleventyConfig.resolvePlugin() is not supported in the `@11ty/client` bundle. You can switch to use the larger `@11ty/client/eleventy` bundle or `import` plugins directly.",
	);
}
