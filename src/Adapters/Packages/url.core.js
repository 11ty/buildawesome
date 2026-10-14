import path from "node:path";

// TODO move this into package-bundler as a shim?
// Thank you bare-url!
// Apache-2.0 LICENSE https://github.com/holepunchto/bare-url/blob/main/LICENSE
export function fileURLToPath(url) {
	if (typeof url === "string") {
		url = new URL(url);
	}

	if (url.protocol !== "file:") {
		throw new Error("The URL must use the file: protocol");
	}

	if (url.hostname) {
		throw new Error("The file: URL host must be 'localhost' or empty");
	}

	if (/%2f/i.test(url.pathname)) {
		throw new Error("The file: URL path must not include encoded / characters");
	}

	return path.normalize(decodeURIComponent(url.pathname));
}
