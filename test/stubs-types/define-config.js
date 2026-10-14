import { defineConfig } from "@11ty/eleventy";

export default defineConfig(($config) => {
	$config.addPassthroughCopy("img");
	// @ts-expect-error
	$config.notARealMethod();
});
