// Directories (trailing slash) return their parent, files return their containing directory.
export default function getParentDirectory(input) {
	// `instanceof String` also allows Nunjucks SafeString.
	if (typeof input !== "string" && !(input instanceof String)) {
		return undefined;
	}

	let str = String(input);

	// Opaque URLs (mailto:, data:, C:) have a "null" origin and are treated as paths.
	let url = URL.canParse(str) ? new URL(str) : undefined;
	if (url && url.origin !== "null") {
		let parent = new URL(url.pathname.endsWith("/") ? "../" : "./", url);
		return parent.origin + parent.pathname;
	}

	// Paths (page.url, page.inputPath) are not encoded, so return an exact prefix of the input.
	let path = str.length > 1 && str.endsWith("/") ? str.slice(0, -1) : str;
	let lastSlash = path.lastIndexOf("/");
	if (lastSlash === -1) {
		return undefined;
	}
	return path.slice(0, lastSlash + 1);
}
