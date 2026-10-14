import type { UserConfig } from "@11ty/eleventy";

export default function ($config: UserConfig) {
	$config.addPassthroughCopy("img");
	// @ts-expect-error
	$config.notARealMethod();
}
