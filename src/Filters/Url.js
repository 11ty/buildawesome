import { TemplatePath } from "@11ty/eleventy-utils";

import { isValidUrl } from "../Util/UrlUtil.js";

// Note: This filter is used in the Eleventy Navigation plugin in versions prior to 0.3.4
export default function (url, pathPrefix) {
	// work with undefined
	url = url || "";

	if (isValidUrl(url) || (url.startsWith("//") && url !== "//")) {
		return url;
	}

	if (pathPrefix === undefined || typeof pathPrefix !== "string") {
		// When you retrieve this with config.getFilter("url") it
		// grabs the pathPrefix argument from your config for you (see defaultConfig.js)
		throw new Error("pathPrefix (String) is required in the `url` filter.");
	}

	let normUrl = TemplatePath.normalizeUrlPath(url);
	let normRootDir = TemplatePath.normalizeUrlPath("/", pathPrefix);
	let normFull = TemplatePath.normalizeUrlPath("/", pathPrefix, url);
	let isRootDirTrailingSlash =
		normRootDir.length && normRootDir.charAt(normRootDir.length - 1) === "/";

	// minor difference with straight `normalize`, "" resolves to root dir and not "."
	// minor difference with straight `normalize`, "/" resolves to root dir
	if (normUrl === "/" || normUrl === normRootDir) {
		return normRootDir + (!isRootDirTrailingSlash ? "/" : "");
	} else if (normUrl.indexOf("/") === 0) {
		return normFull;
	}

	return normUrl;
}
