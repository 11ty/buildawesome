import { fileURLToPath } from "../Adapters/Packages/url.js";
import PathNormalizer from "./PathNormalizer.js";
import { createDebug } from "./DebugLogUtil.js";

const debug = createDebug("EsmResolver");

let lastModifiedPaths = new Map();

export function addToModifiedPaths(path, date) {
	lastModifiedPaths.set(path, date);
}

// Fixes issue https://github.com/11ty/eleventy/issues/3270
// Docs: https://nodejs.org/docs/latest/api/module.html#resolvespecifier-context-nextresolve
export function resolve(specifier, context, nextResolve) {
	try {
		// Not a relative import and not a file import
		// Or from node_modules (perhaps better to check if the specifier is in the project directory instead)
		if (
			(!specifier.startsWith("../") &&
				!specifier.startsWith("./") &&
				!specifier.startsWith("file:")) ||
			context.parentURL.includes("/node_modules/")
		) {
			return nextResolve(specifier, context);
		}

		let fileUrl = new URL(specifier, context.parentURL);
		if (fileUrl.searchParams.has("_cache_bust")) {
			// already is cache busted outside resolver (wider compat, url was changed prior to import, probably in Require.js)
			return nextResolve(specifier, context);
		}

		let absolutePath = PathNormalizer.normalizeSeperator(fileURLToPath(fileUrl));
		// Bust the import cache if this is a recently modified file
		if (lastModifiedPaths.has(absolutePath)) {
			fileUrl.search = ""; // delete existing searchparams
			fileUrl.searchParams.set("_cache_bust", lastModifiedPaths.get(absolutePath));
			debug("Cache busting %o to %o", specifier, fileUrl.toString());

			return nextResolve(fileUrl.toString(), context);
		}
	} catch (e) {
		debug("EsmResolver Error parsing specifier (%o): %o", specifier, e);
	}

	return nextResolve(specifier, context);
}

// export async function load(url, context, nextLoad) {
// }
