import type UserConfig from "@11ty/eleventy/UserConfig";

export default function ($config: UserConfig) {
	$config.addPassthroughCopy("img");
	$config.addBundle("css", { hoist: true });
	$config.getBundleManagers();
	$config.htmlTransformer.addUrlTransform("html", (url: string) => url);
	// @ts-expect-error
	$config.notARealMethod();
}
