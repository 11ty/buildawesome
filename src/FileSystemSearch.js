import { readdir, readdirSync } from "node:fs";
import { glob } from "tinyglobby";
import { TemplatePath } from "@11ty/eleventy-utils";

import { createDebug } from "./Util/DebugLogUtil.js";
import GlobRemap from "./Util/GlobRemap.js";
import { isGlobMatch } from "./Util/GlobMatcher.js";

const debug = createDebug("FileSystemSearch");

class FileSystemSearch {
	#fs;
	#existsCache;

	constructor(existsCache) {
		this.#existsCache = existsCache;
		if (existsCache) {
			// Share the directory listings tinyglobby reads with ExistsCache
			this.#fs = {
				readdir(dir, options, callback) {
					readdir(dir, options, (error, entries) => {
						if (!error) {
							existsCache.addListing(
								dir,
								entries.map((entry) => entry.name),
							);
						}
						callback(error, entries);
					});
				},
				readdirSync(dir, options) {
					let entries = readdirSync(dir, options);
					existsCache.addListing(
						dir,
						entries.map((entry) => entry.name),
					);
					return entries;
				},
			};
		}

		this.inputs = {};
		this.outputs = {};
		this.promises = {};
		this.pendingModifications = {};
		this.count = 0;
	}

	// Case-insensitive file systems (macOS, Windows) can only keep one of these
	static #checkCaseCollisions(paths) {
		let seen = new Map();
		for (let path of paths) {
			let key = path.toLowerCase();
			if (seen.has(key)) {
				throw new Error(
					`File names that differ only by case can’t be used, because case-insensitive file systems (macOS, Windows) keep only one: "${seen.get(key)}" and "${path}". Use \`$config.configureErrorReporting({ allowCaseCollisions: true })\` to allow this on case-sensitive file systems (Linux).`,
				);
			}
			seen.set(key, path);
		}
	}

	getCacheKey(key, globs, options) {
		if (Array.isArray(globs)) {
			globs = globs.sort();
		}
		return key + JSON.stringify(globs) + JSON.stringify(options);
	}

	// returns a promise
	search(key, globs, options = {}) {
		debug("Glob search (%o) searching for: %o", key, globs);

		if (!Array.isArray(globs)) {
			globs = [globs];
		}

		// Strip leading slashes from everything!
		globs = globs.map((entry) => {
			return TemplatePath.stripLeadingDotSlash(entry);
		});

		let cwd = GlobRemap.getCwd(globs);
		if (cwd) {
			options.cwd = cwd;
		}

		if (options.ignore && Array.isArray(options.ignore)) {
			options.ignore = options.ignore.map((entry) => {
				entry = TemplatePath.stripLeadingDotSlash(entry);

				return GlobRemap.remapInput(entry, cwd);
			});
			debug("Glob search (%o) ignoring: %o", key, options.ignore);
		}

		let cacheKey = this.getCacheKey(key, globs, options);

		// Only after the promise has resolved
		if (this.outputs[cacheKey]) {
			return Array.from(this.outputs[cacheKey]);
		}

		if (!this.promises[cacheKey]) {
			this.inputs[cacheKey] = {
				input: globs,
				options,
			};

			this.count++;

			globs = globs.map((entry) => {
				if (cwd && entry.startsWith(cwd)) {
					return GlobRemap.remapInput(entry, cwd);
				}

				return entry;
			});

			options.caseSensitiveMatch ??= false; // insensitive
			options.dot ??= true;

			this.promises[cacheKey] = glob(globs, { ...options, fs: this.#fs }).then((results) => {
				this.outputs[cacheKey] = new Set(
					results.map((entry) => {
						let remapped = GlobRemap.remapOutput(entry, options.cwd);
						return TemplatePath.standardizeFilePath(remapped);
					}),
				);

				if (!this.#existsCache?.allowCaseCollisions) {
					FileSystemSearch.#checkCaseCollisions(this.outputs[cacheKey]);
				}

				// Apply add/delete calls that arrived while the glob was running
				for (let [setOperation, path] of this.pendingModifications[cacheKey] || []) {
					this.outputs[cacheKey][setOperation](path);
				}
				delete this.pendingModifications[cacheKey];

				return Array.from(this.outputs[cacheKey]);
			});
		}

		// may be an unresolved promise
		return this.promises[cacheKey];
	}

	_modify(path, setOperation) {
		// Normalize platform separators (Windows watchers report backslashes) before matching
		let normalized = TemplatePath.standardizeFilePath(path);

		for (let key in this.inputs) {
			let { input, options } = this.inputs[key];
			if (
				!isGlobMatch(normalized, input, {
					ignore: options.ignore,
				})
			) {
				continue;
			}

			if (this.outputs[key]) {
				this.outputs[key][setOperation](normalized);
			} else {
				// Search is still in flight
				this.pendingModifications[key] ??= [];
				this.pendingModifications[key].push([setOperation, normalized]);
			}
		}
	}

	add(path) {
		this._modify(path, "add");
	}

	delete(path) {
		this._modify(path, "delete");
	}

	// Issue #3859 get rid of chokidar globs
	// getAllOutputFiles() {
	// 	return Object.values(this.outputs).map(set => Array.from(set)).flat();
	// }
}

export default FileSystemSearch;
