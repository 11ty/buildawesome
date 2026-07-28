import bundlePlugin from "@11ty/eleventy-plugin-bundle";
import slugify from "@sindresorhus/slugify";

import { HtmlTransformer } from "./Util/HtmlTransformer.js";
import { HtmlRelativeCopyPlugin } from "./Plugins/HtmlRelativeCopyPlugin.js";
import MemoizeUtil from "./Util/MemoizeFunction.js";
import { getEnvValue } from "./Util/EnvironmentVars.cjs";

import urlFilter from "./Filters/Url.js";
import getLocaleCollectionItem from "./Filters/GetLocaleCollectionItem.js";
import getCollectionItemIndex from "./Filters/GetCollectionItemIndex.js";
import getParentDirectory from "./Filters/GetParentDirectory.js";
import { FilterPlugin as InputPathToUrlFilterPlugin } from "./Plugins/InputPathToUrl.js";

/**
 * @typedef {object} config
 * @property {addPlugin} addPlugin - Execute or defer a plugin’s execution.
 * @property {addTransform} addTransform - Add an Eleventy transform to postprocess template output
 * @property {htmlTransformer} htmlTransformer - HTML modification API
 */

/**
 * Extended default configuration object factory.
 *
 * @param {config} $config - Eleventy configuration object.
 * @returns {defaultConfig}
 */
export default function ($config) {
	// Used for the HTML <base>, InputPathToUrl, Image transform plugins
	let htmlTransformer = new HtmlTransformer();
	htmlTransformer.setUserConfig($config);

	// This needs to be assigned before bundlePlugin is added below.
	$config.htmlTransformer = htmlTransformer;

	if (!getEnvValue("SKIP_BUNDLE_PLUGIN")) {
		// Remember: the transform added here runs before the `htmlTransformer` transform
		$config.addPlugin(bundlePlugin, {
			bundles: false, // no default bundles included—must be opt-in.
			immediate: true,
		});
	}

	// Run the `htmlTransformer` transform
	$config.addTransform("@11ty/eleventy/html-transformer", async function (content) {
		// Runs **AFTER** the bundle plugin transform (except: delayed bundles)
		return htmlTransformer.transformContent(this.outputPath, content, this);
	});

	// Requires user configuration, so must run as second-stage
	$config.addPlugin(HtmlRelativeCopyPlugin);

	// Filter: Maps an input path to output URL
	$config.addPlugin(InputPathToUrlFilterPlugin, {
		immediate: true,
	});

	// slug Filter (removed, errors)
	$config.addFilter("slug", function () {
		throw new Error(
			"The `slug` filter (deprecated since v1) has been removed in Eleventy v4. You can add it manually to your configuration file for backwards compatibility, read more at GitHub Issue #3893: https://github.com/11ty/eleventy/issues/3893 Alternatively (more risky), you can swap to use the `slugify` filter instead (outputs may be different and production URLs may break!)",
		);
	});

	// slugify Filter
	$config.addFilter(
		"slugify",
		MemoizeUtil(
			function (str, options = {}) {
				options.decamelize ??= false;

				return slugify("" + str, options);
			},
			{ name: "slugify", bench: $config.benchmarkManager.get("Configuration") },
		),
	);

	// Collection Filters
	$config.addFilter("getCollectionItemIndex", function (collection, pageOverride) {
		return getCollectionItemIndex.call(this, collection, pageOverride);
	});
	$config.addFilter("getCollectionItem", function (collection, pageOverride, langCode) {
		return getLocaleCollectionItem.call(this, $config, collection, pageOverride, langCode, 0);
	});
	$config.addFilter("getPreviousCollectionItem", function (collection, pageOverride, langCode) {
		return getLocaleCollectionItem.call(this, $config, collection, pageOverride, langCode, -1);
	});
	$config.addFilter("getNextCollectionItem", function (collection, pageOverride, langCode) {
		return getLocaleCollectionItem.call(this, $config, collection, pageOverride, langCode, 1);
	});

	// Deprecated, use HtmlBasePlugin instead.
	// Adds a pathPrefix manually to a URL string
	let templateConfig = this;
	$config.addFilter("url", function addPathPrefixFilter(url, pathPrefixOverride) {
		let pathPrefix;
		if (pathPrefixOverride && typeof pathPrefixOverride === "string") {
			pathPrefix = pathPrefixOverride;
		} else {
			pathPrefix = templateConfig.getPathPrefix();
		}

		return urlFilter.call(this, url, pathPrefix);
	});

	// Returns the parent directory of a path
	// For directories (/mydir/): returns parent (/mydir/ -> /)
	// For files (/mydir/file.html): returns containing directory (/mydir/file.html -> /mydir/)
	config.addFilter("getParentDirectory", getParentDirectory);
}
