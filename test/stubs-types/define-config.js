import { defineConfig } from "@11ty/eleventy";

export default defineConfig(($config) => {
	$config.addPassthroughCopy("img");
	$config.addBundle("css", { hoist: true });
	$config.getBundleManagers();
	$config.htmlTransformer.addUrlTransform("html", (url) => url);
	// @ts-expect-error
	$config.notARealMethod();
});
