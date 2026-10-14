export function isValidUrl(url) {
	try {
		new URL(url);
		return true;
	} catch (e) {
		// invalid url OR local path
		return false;
	}
}

export function getDirectoryFromUrl(url) {
	if (url === false) {
		return false;
	}

	// returns a url
	if (url.endsWith("/")) {
		return url;
	}

	let parts = url.split("/");
	parts.pop();
	return parts.join("/") + "/";
}
