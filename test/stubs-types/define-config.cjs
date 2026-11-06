const { defineConfig } = require("@11ty/eleventy");

module.exports = defineConfig(($config) => {
	$config.addPassthroughCopy("img");
	// @ts-expect-error
	$config.notARealMethod();
});
