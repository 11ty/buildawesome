import path from "node:path";
import { TemplatePath } from "@11ty/eleventy-utils";
import { isValidUrl } from "./UrlUtil.js";
import { isGlobMatch } from "./GlobMatcher.js";

// https://github.com/11ty/eleventy/pull/3573

class HtmlRelativeCopy {
	#userConfig;
	#matchingGlobs = new Set();
	#matchingGlobsArray;
	#dirty = false;
	#paths = new Set();
	#failOnError = true;
	#copyOptions = {
		dot: false, // differs from standard passthrough copy
	};

	isEnabled() {
		return this.#matchingGlobs.size > 0;
	}

	setFailOnError(failOnError) {
		this.#failOnError = Boolean(failOnError);
	}

	setCopyOptions(opts) {
		if (opts) {
			Object.assign(this.#copyOptions, opts);
		}
	}

	setUserConfig(userConfig) {
		if (!userConfig || userConfig.constructor.name !== "UserConfig") {
			throw new Error(
				"Internal error: Missing `userConfig` or was not an instance of `UserConfig`.",
			);
		}
		this.#userConfig = userConfig;
	}

	addPaths(paths = []) {
		for (let path of paths) {
			this.#paths.add(TemplatePath.getDir(path));
		}
	}

	get matchingGlobs() {
		if (this.#dirty || !this.#matchingGlobsArray) {
			this.#matchingGlobsArray = Array.from(this.#matchingGlobs);
			this.#dirty = false;
		}

		return this.#matchingGlobsArray;
	}

	addMatchingGlob(glob) {
		if (glob) {
			if (Array.isArray(glob)) {
				for (let g of glob) {
					this.#matchingGlobs.add(g);
				}
			} else {
				this.#matchingGlobs.add(glob);
			}
			this.#dirty = true;
		}
	}

	isSkippableHref(rawRef) {
		if (
			this.#matchingGlobs.size === 0 ||
			!rawRef ||
			path.isAbsolute(rawRef) ||
			isValidUrl(rawRef)
		) {
			return true;
		}
		return false;
	}

	isCopyableTarget(target) {
		if (!isGlobMatch(target, this.matchingGlobs)) {
			return false;
		}

		return true;
	}

	exists(filePath) {
		return this.#userConfig.exists(filePath);
	}

	getAliasedPath(ref) {
		for (let dir of this.#paths) {
			let found = TemplatePath.join(dir, ref);
			if (this.isCopyableTarget(found) && this.exists(found)) {
				return found;
			}
		}
	}

	getFilePathRelativeToProjectRoot(ref, contextFilePath) {
		let dir = TemplatePath.getDirFromFilePath(contextFilePath);
		return TemplatePath.join(dir, ref);
	}

	copy(fileRef, tmplInputPath, tmplOutputPath) {
		// original ref is a full URL or no globs exist
		if (this.isSkippableHref(fileRef)) {
			return;
		}

		// Relative to source file’s input path
		// Maybe use ProjectDirectories.relativeToProjectRoot()
		let source = this.getFilePathRelativeToProjectRoot(fileRef, tmplInputPath);
		if (!this.isCopyableTarget(source)) {
			return;
		}

		if (!this.exists(source)) {
			// Try to alias using `options.paths`
			let alias = this.getAliasedPath(fileRef);
			if (!alias) {
				if (this.#failOnError) {
					throw new Error(
						"Missing input file for `html-relative` Passthrough Copy file: " +
							TemplatePath.absolutePath(source),
					);
				}

				// don’t fail on error
				return;
			}

			source = alias;
		}

		let target = this.getFilePathRelativeToProjectRoot(fileRef, tmplOutputPath);

		// We use a Set here to allow passthrough copy manager to properly error on conflicts upstream
		// Only errors when different inputs write to the same output
		// Also errors if attempts to write outside the output folder.
		this.#userConfig.emit("buildawesome#copy", {
			source,
			target,
			options: this.#copyOptions,
		});
	}
}

export { HtmlRelativeCopy };
