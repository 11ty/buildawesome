/** @param {import("@11ty/eleventy/UserConfig").default} $config */
export default function ($config) {
	$config.addPassthroughCopy("img");
	// @ts-expect-error
	$config.notARealMethod();
}
