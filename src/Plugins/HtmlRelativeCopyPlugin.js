import { HtmlRelativeCopy } from "../Util/HtmlRelativeCopy.js";

// https://github.com/11ty/eleventy/pull/3573

// one HtmlRelativeCopy instance per entry
function init(eleventyConfig, options) {
	if (!eleventyConfig.htmlTransformer) {
		throw new Error(
			"html-relative Passthrough Copy requires eleventyConfig.htmlTransformer support. Are you using the `@11ty/client` bundle? If so, try the `@11ty/client/eleventy` bundle instead.",
		);
	}

	let opts = Object.assign(
		{
			extensions: "html",
			match: false, // can be one glob string or an array of globs
			paths: [], // directories to also look in for files
			failOnError: true, // fails when a path matches (via `match`) but not found on file system
			copyOptions: undefined,
		},
		options,
	);

	let htmlrel = new HtmlRelativeCopy();
	htmlrel.setUserConfig(eleventyConfig);
	htmlrel.addMatchingGlob(opts.match);
	htmlrel.setFailOnError(opts.failOnError);
	htmlrel.setCopyOptions(opts.copyOptions);

	eleventyConfig.htmlTransformer.addUrlTransform(
		opts.extensions,
		function (targetFilepathOrUrl) {
			// @ts-ignore
			htmlrel.copy(targetFilepathOrUrl, this.page.inputPath, this.page.outputPath);

			// TODO front matter option for manual copy
			return targetFilepathOrUrl;
		},
		{
			enabled: () => htmlrel.isEnabled(),
			// - MUST run after other plugins but BEFORE HtmlBase plugin
			priority: -1,
		},
	);

	htmlrel.addPaths(opts.paths);
}

function HtmlRelativeCopyPlugin(eleventyConfig) {
	// Important: if this is empty, no URL transforms are added
	for (let options of eleventyConfig.passthroughCopiesHtmlRelative) {
		init(eleventyConfig, options);
	}
}

Object.defineProperty(HtmlRelativeCopyPlugin, "eleventyPackage", {
	value: "@11ty/eleventy/html-relative-copy-plugin",
});

export { HtmlRelativeCopyPlugin };
