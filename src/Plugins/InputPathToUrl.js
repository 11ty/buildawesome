import path from "node:path";
import { TemplatePath } from "@11ty/eleventy-utils";
import { isValidUrl } from "../Util/UrlUtil.js";

function getValidPath(contentMap, testPath) {
	// if the path is coming from Markdown, it may be encoded
	let normalized = TemplatePath.addLeadingDotSlash(decodeURIComponent(testPath));

	// it must exist in the content map to be valid
	if (contentMap[normalized]) {
		return normalized;
	}
}

function normalizeInputPath(targetInputPath, inputDir, sourceInputPath, contentMap) {
	// inputDir is optional at the beginning of the developer supplied-path

	// Input directory already on the input path
	if (TemplatePath.join(targetInputPath).startsWith(TemplatePath.join(inputDir))) {
		let absolutePath = getValidPath(contentMap, targetInputPath);
		if (absolutePath) {
			return absolutePath;
		}
	}

	// Relative to project input directory
	let relativeToInputDir = getValidPath(contentMap, TemplatePath.join(inputDir, targetInputPath));
	if (relativeToInputDir) {
		return relativeToInputDir;
	}

	if (targetInputPath && !path.isAbsolute(targetInputPath)) {
		// Relative to source file’s input path
		let sourceInputDir = TemplatePath.getDirFromFilePath(sourceInputPath);
		let relativeToSourceFile = getValidPath(
			contentMap,
			TemplatePath.join(sourceInputDir, targetInputPath),
		);
		if (relativeToSourceFile) {
			return relativeToSourceFile;
		}
	}

	// the transform may have sent in a URL so we just return it as-is
	return targetInputPath;
}

function parseFilePath(filepath) {
	if (filepath.startsWith("#") || filepath.startsWith("?")) {
		return [filepath, ""];
	}

	try {
		/* u: URL {
			href: 'file:///tmpl.njk#anchor',
			origin: 'null',
			protocol: 'file:',
			username: '',
			password: '',
			host: '',
			hostname: '',
			port: '',
			pathname: '/tmpl.njk',
			search: '',
			searchParams: URLSearchParams {},
			hash: '#anchor'
		} */

		// Note that `node:url` -> pathToFileURL creates an absolute path, which we don’t want
		// URL(`file:#anchor`) gives back a pathname of `/`
		let u = new URL(`file:${filepath}`);
		filepath = filepath.replace(u.search, ""); // includes ?
		filepath = filepath.replace(u.hash, ""); // includes #

		return [
			// search includes ?, hash includes #
			u.search + u.hash,
			filepath,
		];
	} catch (e) {
		return ["", filepath];
	}
}

function FilterPlugin(eleventyConfig) {
	let contentMap;
	eleventyConfig.on("buildawesome.contentmap", function ({ inputPathToUrl }) {
		contentMap = inputPathToUrl;
	});

	eleventyConfig.addFilter("inputPathToUrl", function (targetFilePath) {
		if (!contentMap) {
			throw new Error("Internal error: contentMap not available for `inputPathToUrl` filter.");
		}

		if (isValidUrl(targetFilePath)) {
			return targetFilePath;
		}

		let inputDir = eleventyConfig.directories.input;
		let suffix;
		[suffix, targetFilePath] = parseFilePath(targetFilePath);
		if (targetFilePath) {
			targetFilePath = normalizeInputPath(
				targetFilePath,
				inputDir,
				// @ts-ignore
				this.page.inputPath,
				contentMap,
			);
		}

		let urls = contentMap[targetFilePath];
		if (!urls || urls.length === 0) {
			throw new Error(
				"`inputPathToUrl` filter could not find a matching target for " + targetFilePath,
			);
		}

		return `${urls[0]}${suffix}`;
	});
}

function TransformPlugin(eleventyConfig, defaultOptions = {}) {
	let opts = Object.assign(
		{
			extensions: "html",
		},
		defaultOptions,
	);

	let contentMap = null;
	eleventyConfig.on("buildawesome.contentmap", function ({ inputPathToUrl }) {
		contentMap = inputPathToUrl;
	});

	eleventyConfig.htmlTransformer.addUrlTransform(opts.extensions, function (targetFilepathOrUrl) {
		if (!contentMap) {
			throw new Error("Internal error: contentMap not available for the `pathToUrl` Transform.");
		}
		if (isValidUrl(targetFilepathOrUrl)) {
			return targetFilepathOrUrl;
		}

		let inputDir = eleventyConfig.directories.input;

		let suffix;
		[suffix, targetFilepathOrUrl] = parseFilePath(targetFilepathOrUrl);
		if (targetFilepathOrUrl) {
			targetFilepathOrUrl = normalizeInputPath(
				targetFilepathOrUrl,
				inputDir,
				// @ts-ignore
				this.page.inputPath,
				contentMap,
			);
		}

		let urls = contentMap[targetFilepathOrUrl];
		if (!targetFilepathOrUrl || !urls || urls.length === 0) {
			// fallback, transforms don’t error on missing paths (though the pathToUrl filter does)
			return `${targetFilepathOrUrl}${suffix}`;
		}

		return `${urls[0]}${suffix}`;
	});
}

Object.defineProperty(FilterPlugin, "eleventyPackage", {
	value: "@11ty/eleventy/inputpath-to-url-filter-plugin",
});

Object.defineProperty(FilterPlugin, "eleventyPluginOptions", {
	value: {
		unique: true,
	},
});

Object.defineProperty(TransformPlugin, "eleventyPackage", {
	value: "@11ty/eleventy/inputpath-to-url-transform-plugin",
});

Object.defineProperty(TransformPlugin, "eleventyPluginOptions", {
	value: {
		unique: true,
	},
});

export default TransformPlugin;

export { FilterPlugin, TransformPlugin };
