import { glob } from "tinyglobby";
import { TemplatePath } from "@11ty/eleventy-utils";

import { createDebug } from "./Util/DebugLogUtil.js";
import GlobRemap from "./Util/GlobRemap.js";
import { isGlobMatch } from "./Util/GlobMatcher.js";

const debug = createDebug("FileSystemSearch");

class FileSystemSearch {
	constructor() {
		this.inputs = {};
		this.outputs = {};
		this.promises = {};
		this.count = 0;
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

			this.promises[cacheKey] = glob(globs, options).then((results) => {
				this.outputs[cacheKey] = new Set(
					results.map((entry) => {
						let remapped = GlobRemap.remapOutput(entry, options.cwd);
						return TemplatePath.standardizeFilePath(remapped);
					}),
				);

				return Array.from(this.outputs[cacheKey]);
			});
		}

		// may be an unresolved promise
		return this.promises[cacheKey];
	}

	_modify(path, setOperation) {
		path = TemplatePath.stripLeadingDotSlash(path);

		let normalized = TemplatePath.standardizeFilePath(path);

		for (let key in this.inputs) {
			let { input, options } = this.inputs[key];
			if (
				isGlobMatch(path, input, {
					ignore: options.ignore,
				})
			) {
				this.outputs[key][setOperation](normalized);
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
