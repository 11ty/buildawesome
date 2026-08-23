import HtmlBasePlugin from "../Plugins/HtmlBasePlugin.js";
import InputPathToUrlPlugin from "../Plugins/InputPathToUrl.js";

/** @param {string} name */
export function resolvePlugin(name) {
	let filenameLookup = {
		// Sync, https://github.com/11ty/eleventy-plugin-rss/issues/52
		"@11ty/eleventy/html-base-plugin": HtmlBasePlugin,
		"@11ty/eleventy/inputpath-to-url-plugin": InputPathToUrlPlugin,

		// Async plugins:
		// v4 moved RenderPlugin async for bundle size (Liquid import)
		"@11ty/eleventy/render-plugin": "./Plugins/RenderPlugin.js", // Liquid is ~73KB min
		"@11ty/eleventy/i18n-plugin": "./Plugins/I18nPlugin.js", // bcp-47-normalize is ~180KB min
	};

	if (!filenameLookup[name]) {
		throw new Error(
			`Invalid name "${name}" passed to resolvePlugin. Valid options: ${Object.keys(filenameLookup).join(", ")}`,
		);
	}

	// Future improvement: add support for any npm package name?
	if (typeof filenameLookup[name] === "string") {
		// returns promise
		return import(/* @vite-ignore */ filenameLookup[name]).then((plugin) => plugin.default);
	}

	// return reference
	return filenameLookup[name];
}
