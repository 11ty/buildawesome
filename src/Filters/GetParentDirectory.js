/**
 * Returns the parent directory of a given path.
 *
 * For directory paths (ending with /): returns the parent directory
 * For file paths: returns the directory containing the file
 *
 * Examples:
 *   /mydir/           -> /
 *   /mydir/slug.html  -> /mydir/
 *   /mydir/index.md   -> /mydir/
 *   /a/b/c/           -> /a/b/
 *   /file.html        -> /
 *
 * @param {string} path - The path to get the parent directory of
 * @returns {string} The parent directory path
 */
export default function getParentDirectory(path) {
	if (!path || typeof path !== "string") {
		return "";
	}

	// If path ends with /, it's a directory - get its parent
	if (path.endsWith("/") && path.length > 1) {
		// Remove trailing slash, then find parent
		let withoutTrailing = path.slice(0, -1);
		let lastSlash = withoutTrailing.lastIndexOf("/");
		if (lastSlash === -1) {
			return "/";
		}
		return withoutTrailing.slice(0, lastSlash + 1) || "/";
	}

	// Handle root directory
	if (path === "/") {
		return "/";
	}

	// Otherwise it's a file path - get the directory containing it
	let lastSlash = path.lastIndexOf("/");
	if (lastSlash === -1) {
		// No slash found, no parent directory
		return "";
	}
	if (lastSlash === 0) {
		// File is at root level
		return "/";
	}
	return path.slice(0, lastSlash + 1);
}
