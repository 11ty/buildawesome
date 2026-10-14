const POSTHTML_PLUGIN_NAME = "11ty/eleventy/preserve-closing-tags";

export function PreserveClosingTagsPlugin(eleventyConfig, options = {}) {
	// TODO error on non-void eligible tag names
	if (!options.tags) {
		// "meta"
		options.tags = [];
	}

	if (!Array.isArray(options.tags)) {
		throw new Error("`tags` passed to the Preserve Closing Tags plugin must be an Array");
	}

	const tagMatches = options.tags.map((tag) => ({ tag }));
	if (tagMatches.length === 0) {
		return;
	}

	eleventyConfig.htmlTransformer.addPosthtmlPlugin(
		"html",
		function preserveClosingTagsPlugin(pluginOptions = {}) {
			return function (tree) {
				tree.match(tagMatches, function (node) {
					node.closeAs = "slash"; // close eligible tags as `<meta />` and not `<meta>`
					return node;
				});
			};
		},
		{
			// pluginOptions
			name: POSTHTML_PLUGIN_NAME,
		},
	);
}
