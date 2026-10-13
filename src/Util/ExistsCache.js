import { existsSync, statSync } from "node:fs";
import { TemplatePath } from "@11ty/eleventy-utils";

// Checks both files and directories
class ExistsCache {
	#exists = new Map();
	#dirs = new Map();

	constructor() {
		this.lookupCount = 0;
	}

	reset() {
		this.#exists = new Map();
		this.#dirs = new Map();
	}

	get size() {
		return this.#exists.size;
	}

	has(path) {
		return this.#exists.has(path);
	}

	set(path, isExist) {
		this.#exists.set(TemplatePath.addLeadingDotSlash(path), Boolean(isExist));
	}

	// Looked up again next time, e.g. a file added or deleted while watching
	delete(path) {
		for (let key of [path, TemplatePath.addLeadingDotSlash(path)]) {
			this.#exists.delete(key);
			this.#dirs.delete(key);
		}
	}

	// Not yet needed
	// setDirectory(path, isExist) {}

	// Relative paths (to root directory) expected (but not enforced due to perf costs)
	exists(path) {
		if (!this.#exists.has(path)) {
			let exists = existsSync(path);
			this.lookupCount++;

			// mark for next time
			this.#exists.set(path, Boolean(exists));

			return exists;
		}

		return this.#exists.get(path);
	}

	isDirectory(path) {
		if (!this.exists(path)) {
			return false;
		}

		if (!this.#dirs.has(path)) {
			let isDir = statSync(path).isDirectory();
			this.lookupCount++;

			// mark for next time
			this.#dirs.set(path, isDir);

			return isDir;
		}

		return this.#dirs.get(path);
	}
}

export default ExistsCache;
