import { Eleventy } from "@11ty/eleventy";

new Eleventy({
	input: "src",
	output: "_site",
	config($config) {
		$config.addPassthroughCopy("img");
		// @ts-expect-error
		$config.notARealMethod();
	},
});

// @ts-expect-error
new Eleventy({ runMode: "not-a-run-mode" });
