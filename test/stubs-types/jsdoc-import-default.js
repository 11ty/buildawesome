/** @import UserConfig from "@11ty/eleventy/UserConfig" */
/** @param {UserConfig} $config */
export default function ($config) {
	$config.addPassthroughCopy("img");
	// @ts-expect-error
	$config.notARealMethod();
}
