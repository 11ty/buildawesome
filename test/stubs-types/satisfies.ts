import type { ConfigurationApi } from "@11ty/eleventy";

export default (($config) => {
	$config.addPassthroughCopy("img");
	// @ts-expect-error
	$config.notARealMethod();
}) satisfies ConfigurationApi;
