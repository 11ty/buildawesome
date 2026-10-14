export function isGlobMatch() {
	throw new Error(
		"Glob matching (e.g. getFilteredByGlob collection API method) is not supported in the `@11ty/client` bundle. Use the `@11ty/client/eleventy` bundle instead.",
	);
}

// When using a glob as an input (see ProjectDirectories)
export function isDynamicPattern(pattern) {
	return false;
}
