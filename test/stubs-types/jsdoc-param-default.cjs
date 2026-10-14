/** @param {import("@11ty/eleventy/UserConfig").default} $config */
module.exports = function ($config) {
	$config.addPassthroughCopy("img");
	// @ts-expect-error
	$config.notARealMethod();
};
