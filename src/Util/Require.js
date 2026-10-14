import { readFileSync } from "node:fs";
import path from "node:path";
import { TemplatePath } from "@11ty/eleventy-utils";

import importer from "./importer.js";
import { clearRequireCache, requireCommonJsTypeScript } from "../Util/RequireUtils.js";
import { addModifiedPath } from "./EsmResolverPortAdapter.js";
import BaseError from "../Errors/BaseError.js";
import eventBus from "../EventBus.js";

class ImportError extends BaseError {}

const requestPromiseCache = new Map();

function isCommonJSTypeScript(filePath, type) {
	return (type === "cjs" && filePath.endsWith(".ts")) || filePath.endsWith(".cts"); // no .mts here
}

function getImportErrorMessage(filePath, type) {
	return `There was a problem importing '${path.relative(".", filePath)}' via ${type}`;
}

// Used for JSON imports, suffering from Node warning that import assertions experimental but also
// throwing an error if you try to import() a JSON file without an import assertion.
/**
 *
 * @returns {string|undefined}
 */
function loadContents(path, options = {}) {
	let rawInput;
	/** @type {string} */
	let encoding = "utf8"; // JSON is utf8
	if (options?.encoding || options?.encoding === null) {
		encoding = options.encoding;
	}

	try {
		// @ts-expect-error This is an error in the upstream types
		rawInput = readFileSync(path, encoding);
	} catch (error) {
		// @ts-expect-error Temporary
		if (error?.code === "ENOENT") {
			// if file does not exist, return nothing
			return;
		}

		throw error;
	}

	// Can return a buffer, string, etc
	if (typeof rawInput === "string") {
		rawInput = rawInput.trim();
	}

	return rawInput;
}

let lastModifiedPaths = new Map();
eventBus.on("buildawesome.importcachereset", (fileQueue) => {
	for (let filePath of fileQueue) {
		let absolutePath = TemplatePath.absolutePath(filePath);
		let newDate = Date.now();
		lastModifiedPaths.set(absolutePath, newDate);

		// post to EsmResolver worker thread
		addModifiedPath(absolutePath, newDate);

		clearRequireCache(absolutePath);
	}
});

// raw means we don’t normalize away the `default` export
async function dynamicImportAbsolutePath(absolutePath, options = {}) {
	let { type, returnRaw, cacheBust } = Object.assign(
		{
			type: undefined,
			returnRaw: false,
			cacheBust: false, // force cache bust
		},
		options,
	);

	// Short circuit for JSON files (that are optional and can be empty)
	if (absolutePath.endsWith(".json") || type === "json") {
		try {
			// https://v8.dev/features/import-assertions#dynamic-import() is still experimental in Node 20
			let rawInput = loadContents(absolutePath);
			if (!rawInput) {
				// should not error when file exists but is _empty_
				return;
			}
			return JSON.parse(rawInput);
		} catch (e) {
			return Promise.reject(
				new ImportError(getImportErrorMessage(absolutePath, "fs.readFile(json)"), e),
			);
		}
	}

	// Removed a `require` short circuit from this piece originally added
	// in https://github.com/11ty/eleventy/pull/3493 Was a bit faster but
	// error messaging was worse for require(esm)

	// Workaround for Node issue https://github.com/nodejs/node/issues/61385
	// Remove this when fixed upstream!
	if (isCommonJSTypeScript(absolutePath, type)) {
		return requireCommonJsTypeScript(absolutePath);
	}

	let urlPath;
	try {
		let u = new URL(`file:${absolutePath}`);

		// Bust the import cache if this is the last modified file (or cache busting is forced)
		if (cacheBust) {
			lastModifiedPaths.set(absolutePath, Date.now());
		}

		if (cacheBust || lastModifiedPaths.has(absolutePath)) {
			u.searchParams.set("_cache_bust", lastModifiedPaths.get(absolutePath));
		}

		urlPath = u.toString();
	} catch (e) {
		urlPath = absolutePath;
	}

	let promise;
	if (requestPromiseCache.has(urlPath)) {
		promise = requestPromiseCache.get(urlPath);
	} else {
		promise = importer(urlPath);
		requestPromiseCache.set(urlPath, promise);
	}

	return promise.then(
		(target) => {
			if (returnRaw) {
				return target;
			}

			// If the only export is `default`, elevate to top (for ESM and CJS)
			if (Object.keys(target).length === 1 && "default" in target) {
				return target.default;
			}

			// When using import() on a CommonJS file that exports an object sometimes it
			// returns duplicated values in `default` key, e.g. `{ default: {key: value}, key: value }`

			// A few examples:
			// module.exports = { key: false };
			//    returns `{ default: {key: false}, key: false }` as not expected.
			// module.exports = { key: true };
			// module.exports = { key: null };
			// module.exports = { key: undefined };
			// module.exports = { key: class {} };

			// A few examples where it does not duplicate:
			// module.exports = { key: 1 };
			//    returns `{ default: {key: 1} }` as expected.
			// module.exports = { key: "value" };
			// module.exports = { key: {} };
			// module.exports = { key: [] };

			if (type === "cjs" && "default" in target) {
				let match = true;
				for (let key in target) {
					if (key === "default") {
						continue;
					}
					if (key === "module.exports") {
						continue;
					}
					if (target[key] !== target.default[key]) {
						match = false;
					}
				}

				if (match) {
					return target.default;
				}
			}

			// Otherwise return { default: value, named: value }
			// Object.assign here so we can add things to it in JavaScript.js
			return Object.assign({}, target);
		},
		(error) => {
			return Promise.reject(
				new ImportError(getImportErrorMessage(absolutePath, `import(${type})`), error),
			);
		},
	);
}

async function dynamicImport(localPath, type, options = {}) {
	let absolutePath = TemplatePath.absolutePath(localPath);
	options.type = type;

	// Returns promise
	return dynamicImportAbsolutePath(absolutePath, options);
}

/* Used to import app configuration files, raw means we don’t normalize away the `default` export */
async function dynamicImportRaw(localPath, type) {
	let absolutePath = TemplatePath.absolutePath(localPath);

	// Returns promise
	return dynamicImportAbsolutePath(absolutePath, { type, returnRaw: true });
}

export {
	loadContents as LoadContent,
	dynamicImport as DynamicImport,
	dynamicImportRaw as DynamicImportRaw,
};
