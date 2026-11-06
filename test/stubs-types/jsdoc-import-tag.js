/** @import { UserConfig } from "@11ty/eleventy" */
/** @param {UserConfig} $config */
export default function ($config) {
	$config.addPassthroughCopy("img");
	// @ts-expect-error
	$config.notARealMethod();
}
