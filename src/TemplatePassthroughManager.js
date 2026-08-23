import { TemplatePath } from "@11ty/eleventy-utils";

import BaseError from "./Errors/BaseError.js";
import TemplatePassthrough from "./TemplatePassthrough.js";
import checkPassthroughCopyBehavior from "./Util/PassthroughCopyBehaviorCheck.js";
import { isGlobMatch, isDynamicPattern } from "./Util/GlobMatcher.js";
import { createDebug } from "./Util/DebugLogUtil.js";

const debug = createDebug("TemplatePassthroughManager");

class TemplatePassthroughManagerCopyError extends BaseError {}

class TemplatePassthroughManager {
	#isDryRun = false;
	#afterBuild;
	#queue = new Map();
	#extensionMap;

	constructor(templateConfig) {
		if (!templateConfig || templateConfig.constructor.name !== "TemplateConfig") {
			throw new Error("Internal error: Missing or invalid `templateConfig` argument.");
		}

		this.templateConfig = templateConfig;
		this.config = templateConfig.getConfig();

		// eleventy# event listeners are removed on each build
		this.config.events.on("buildawesome#copy", ({ source, target, options }) => {
			this.enqueueCopy(source, target, options);
		});

		this.config.events.on("buildawesome#beforerender", () => {
			this.#afterBuild = Promise.withResolvers();
		});

		this.config.events.on("buildawesome#render", () => {
			let { resolve } = this.#afterBuild;
			resolve();
		});

		this.reset();
	}

	reset() {
		this.count = 0;
		this.size = 0;
		this.conflictMap = {};
		this.incrementalFiles = [];

		this.#queue = new Map();
	}

	set extensionMap(extensionMap) {
		this.#extensionMap = extensionMap;
	}

	get extensionMap() {
		if (!this.#extensionMap) {
			throw new Error("Internal error: missing `extensionMap` in TemplatePassthroughManager.");
		}
		return this.#extensionMap;
	}

	get inputDir() {
		return this.templateConfig.directories.input;
	}

	get outputDir() {
		return this.templateConfig.directories.output;
	}

	setDryRun(isDryRun) {
		this.#isDryRun = Boolean(isDryRun);
	}

	setRunMode(runMode) {
		this.runMode = runMode;
	}

	setIncrementalFiles(paths) {
		if (!paths || !Array.isArray(paths)) {
			return;
		}
		this.incrementalFiles = paths;
	}

	resetIncremental() {
		this.incrementalFiles = undefined;
	}

	#normalizePath(path, outputPath, copyOptions = {}) {
		let inputPath = TemplatePath.addLeadingDotSlash(path);

		return {
			inputPath,
			outputPath: outputPath ? TemplatePath.stripLeadingDotSlash(outputPath) : true,
			copyOptions,
			// eligible if args.length > 1
			isDynamicPattern: outputPath && isDynamicPattern(inputPath),
		};
	}

	getConfigPaths() {
		let paths = [];
		let pathsRaw = this.config.passthroughCopies || {};
		debug("`addPassthroughCopy` config API paths: %o", pathsRaw);
		for (let [inputPath, { outputPath, copyOptions }] of Object.entries(pathsRaw)) {
			paths.push(this.#normalizePath(inputPath, outputPath, copyOptions));
		}
		debug("`addPassthroughCopy` config API normalized paths: %o", paths);
		return paths;
	}

	getConfigPathGlobs() {
		return this.getConfigPaths().map((path) => {
			return TemplatePath.convertToRecursiveGlobSync(path.inputPath);
		});
	}

	getNonTemplatePaths(paths) {
		let matches = [];
		for (let path of paths) {
			if (!this.extensionMap.hasEngine(path)) {
				matches.push(path);
			}
		}

		return matches;
	}

	getCopyCount() {
		return this.count;
	}

	getCopySize() {
		return this.size;
	}

	getMetadata() {
		return {
			copyCount: this.getCopyCount(),
			copySize: this.getCopySize(),
		};
	}

	setFileSystemSearch(fileSystemSearch) {
		this.fileSystemSearch = fileSystemSearch;
	}

	getTemplatePassthroughForPath(path) {
		let inst = new TemplatePassthrough(path, this.templateConfig);

		inst.setFileSystemSearch(this.fileSystemSearch);
		inst.setDryRun(this.#isDryRun);
		inst.setRunMode(this.runMode);

		return inst;
	}

	async copyPassthrough(pass) {
		if (!(pass instanceof TemplatePassthrough)) {
			throw new TemplatePassthroughManagerCopyError(
				"copyPassthrough expects an instance of TemplatePassthrough",
			);
		}

		let { inputPath } = pass.getPath();

		// TODO https://github.com/11ty/eleventy/issues/2452
		// De-dupe both the input and output paired together to avoid the case
		// where an input/output pair has been added via multiple passthrough methods (glob, file suffix, etc)
		// Probably start with the `filter` callback in recursive-copy but it only passes relative paths
		// See the note in TemplatePassthrough.js->write()

		// Also note that `recursive-copy` handles repeated overwrite copy to the same destination just fine.
		// e.g. `for(let j=0, k=1000; j<k; j++) { copy("coolkid.jpg", "_site/coolkid.jpg"); }`

		// Eventually we’ll want to move all of this to use Node’s fs.cp, which is experimental and only on Node 16+

		return pass.write().then(
			({ size, count, map }) => {
				for (let src in map) {
					let dest = map[src];
					if (this.conflictMap[dest]) {
						if (src !== this.conflictMap[dest]) {
							let paths = [src, this.conflictMap[dest]].sort();
							throw new TemplatePassthroughManagerCopyError(
								`Multiple passthrough copy files are trying to write to the same output file (${TemplatePath.standardizeFilePath(dest)}). ${paths.map((p) => TemplatePath.standardizeFilePath(p)).join(" and ")}`,
							);
						} else {
							// Multiple entries from the same source
							debug(
								"A passthrough copy entry (%o) caused the same file (%o) to be copied more than once to the output (%o). This is atomically safe but a waste of build resources.",
								inputPath,
								src,
								dest,
							);
						}
					}

					this.conflictMap[dest] = src;
				}

				if (pass.isDryRun) {
					// We don’t count the skipped files as we need to iterate over them
					debug(
						"Skipped %o (either from --dryrun or --incremental or for-free passthrough copy)",
						inputPath,
					);
				} else {
					if (count) {
						this.count += count;
						this.size += size;
						debug("Copied %o (%d files, %d size)", inputPath, count || 0, size || 0);
					} else {
						debug("Skipped copying %o (emulated passthrough copy)", inputPath);
					}
				}

				return {
					count,
					map,
				};
			},
			function (e) {
				return Promise.reject(
					new TemplatePassthroughManagerCopyError(`Having trouble copying '${inputPath}'`, e),
				);
			},
		);
	}

	filterToPassthroughCopyFilesOnly(eligiblePaths, changedFiles) {
		if (!changedFiles) {
			return [];
		}

		if (!Array.isArray(changedFiles)) {
			changedFiles = [changedFiles];
		}

		let configPaths = this.getConfigPaths();
		let matchedConfigPaths = new Set();

		return changedFiles
			.map((changedFilePath) => {
				// passthrough copy by non-matching engine extension (via templateFormats)
				if (
					eligiblePaths.includes(changedFilePath) &&
					!this.extensionMap.hasEngine(changedFilePath)
				) {
					return changedFilePath;
				}

				let eligibleConfigPath = configPaths.find((configPath) => {
					if (TemplatePath.startsWithSubPath(changedFilePath, configPath.inputPath)) {
						return true;
					}
					if (configPath.isDynamicPattern && isGlobMatch(changedFilePath, [configPath.inputPath])) {
						return true;
					}
				});

				// importantly: returns config path, not changed file path
				if (eligibleConfigPath && !matchedConfigPaths.has(eligibleConfigPath.inputPath)) {
					matchedConfigPaths.add(eligibleConfigPath.inputPath);
					return eligibleConfigPath;
				}

				return false;
			})
			.filter(Boolean);
	}

	getAllNormalizedPaths(paths = []) {
		if (Array.isArray(this.incrementalFiles) && this.incrementalFiles.length > 0) {
			let passthroughIncrementalFiles = this.filterToPassthroughCopyFilesOnly(
				paths,
				this.incrementalFiles,
			);
			if (passthroughIncrementalFiles.length > 0) {
				return passthroughIncrementalFiles.map((file) => {
					if (file.outputPath) {
						return file;
					}

					return this.#normalizePath(file);
				});
			}

			// Fixes https://github.com/11ty/eleventy/issues/2491
			if (!checkPassthroughCopyBehavior(this.config, this.runMode)) {
				return [];
			}
		}

		let normalizedPaths = this.getConfigPaths();
		if (debug.enabled) {
			for (let path of normalizedPaths) {
				debug("TemplatePassthrough copying from config: %o", path);
			}
		}

		if (paths?.length) {
			let passthroughPaths = this.getNonTemplatePaths(paths);
			for (let path of passthroughPaths) {
				let normalizedPath = this.#normalizePath(path);

				debug(
					`TemplatePassthrough copying from non-matching file extension: ${normalizedPath.inputPath}`,
				);

				normalizedPaths.push(normalizedPath);
			}
		}

		return normalizedPaths;
	}

	// keys: output
	// values: input
	getAliasesFromPassthroughResults(result) {
		let entries = {};
		for (let entry of result) {
			for (let src in entry.map) {
				let dest = TemplatePath.stripLeadingSubPath(entry.map[src], this.outputDir);
				entries["/" + encodeURI(dest)] = src;
			}
		}
		return entries;
	}

	async #waitForTemplatesRendered() {
		if (!this.#afterBuild) {
			return Promise.resolve(); // immediately resolve
		}

		let { promise } = this.#afterBuild;
		return promise;
	}

	enqueueCopy(source, target, copyOptions) {
		let key = `${source}=>${target}`;

		// light de-dupe the same source/target combo (might be in the same file, might be viaTransforms)
		if (this.#queue.has(key)) {
			return;
		}

		let passthrough = TemplatePassthrough.factory(source, target, {
			templateConfig: this.templateConfig,
			copyOptions,
		});

		passthrough.setCheckSourceDirectory(true);
		passthrough.setIsAlreadyNormalized(true);
		passthrough.setRunMode(this.runMode);
		passthrough.setDryRun(this.#isDryRun);

		this.#queue.set(key, this.copyPassthrough(passthrough));
	}

	async copyAll(templateExtensionPaths) {
		debug("TemplatePassthrough copy started.");
		let normalizedPaths = this.getAllNormalizedPaths(templateExtensionPaths);

		let passthroughs = normalizedPaths.map((path) => this.getTemplatePassthroughForPath(path));

		let promises = passthroughs.map((pass) => this.copyPassthrough(pass));

		await this.#waitForTemplatesRendered();

		for (let [key, afterBuildCopyPromises] of this.#queue) {
			promises.push(afterBuildCopyPromises);
		}

		return Promise.all(promises).then(async (results) => {
			let aliases = this.getAliasesFromPassthroughResults(results);
			await this.config.events.emit("buildawesome.passthrough", {
				map: aliases,
			});

			debug(`TemplatePassthrough copy finished. Current count: ${this.count} (size: ${this.size})`);
			return results;
		});
	}
}

export default TemplatePassthroughManager;
