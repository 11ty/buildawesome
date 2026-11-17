import { HtmlBasePlugin } from "../Plugins/HtmlBasePlugin.js";
import { InputPathToUrlTransformPlugin } from "../Plugins/InputPathToUrl.js";

/** @param {string} name */
export function resolvePlugin(name) {
	let filenameLookup = {
		// Sync, https://github.com/11ty/eleventy-plugin-rss/issues/52
		"@11ty/eleventy/html-base-plugin": HtmlBasePlugin,
		"@11ty/eleventy/inputpath-to-url-plugin": InputPathToUrlTransformPlugin,

		// Async plugins:
		// v4 moved RenderPlugin async for bundle size (Liquid import)
		"@11ty/eleventy/render-plugin": ["../Plugins/RenderPlugin.js", "RenderPlugin"], // Liquid is ~73KB min
		"@11ty/eleventy/i18n-plugin": ["../Plugins/I18nPlugin.js", "I18nPlugin"],
	};

	if (!filenameLookup[name]) {
		throw new Error(
			`Invalid name "${name}" passed to resolvePlugin. Valid options: ${Object.keys(filenameLookup).join(", ")}`,
		);
	}

	// Future improvement: add support for any npm package name?
	if (Array.isArray(filenameLookup[name])) {
		let [path, exportName] = filenameLookup[name];
		// returns promise
		return import(/* @vite-ignore */ path).then((mod) => mod[exportName]);
	}

	// return reference
	return filenameLookup[name];
}
