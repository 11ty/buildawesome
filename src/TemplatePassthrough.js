import path from "node:path";

import copy from "@11ty/recursive-copy";
import { TemplatePath } from "@11ty/eleventy-utils";

import { readableFileSize } from "./Util/FileSize.js";
import { isDynamicPattern } from "./Util/GlobMatcher.js";
import BaseError from "./Errors/BaseError.js";
import checkPassthroughCopyBehavior from "./Util/PassthroughCopyBehaviorCheck.js";
import ProjectDirectories from "./Util/ProjectDirectories.js";
import { createDebug } from "./Util/DebugLogUtil.js";

const debug = createDebug("TemplatePassthrough");

class TemplatePassthroughError extends BaseError {}

class TemplatePassthrough {
	isDryRun = false;
	#isInputPathGlob;
	#benchmarks;
	#isAlreadyNormalized = false;
	#projectDirCheck = false;

	// paths already guaranteed from the autocopy plugin
	static factory(inputPath, outputPath, opts = {}) {
		let p = new TemplatePassthrough(
			{
				inputPath,
				outputPath,
				copyOptions: opts.copyOptions,
			},
			opts.templateConfig,
		);

		return p;
	}

	constructor(path, templateConfig) {
		if (!templateConfig || templateConfig.constructor.name !== "TemplateConfig") {
			throw new Error(
				"Internal error: Missing `templateConfig` or was not an instance of `TemplateConfig`.",
			);
		}
		this.templateConfig = templateConfig;

		this.rawPath = path;

		// inputPath is relative to the root of your project and not your Eleventy input directory.
		// TODO normalize these with forward slashes
		this.inputPath = this.normalizeIfDirectory(path.inputPath);
		this.#isInputPathGlob = isDynamicPattern(this.inputPath);

		this.outputPath = path.outputPath;
		this.copyOptions = path.copyOptions; // custom options for recursive-copy
	}

	get benchmarks() {
		if (!this.#benchmarks) {
			this.#benchmarks = {
				aggregate: this.config.benchmarkManager.get("Aggregate"),
			};
		}

		return this.#benchmarks;
	}

	get config() {
		return this.templateConfig.getConfig();
	}

	get directories() {
		return this.templateConfig.directories;
	}

	// inputDir is used when stripping from output path in `getOutputPath`
	get inputDir() {
		return this.templateConfig.directories.input;
	}

	get outputDir() {
		return this.templateConfig.directories.output;
	}

	// Skips `getFiles()` normalization
	setIsAlreadyNormalized(isNormalized) {
		this.#isAlreadyNormalized = Boolean(isNormalized);
	}

	setCheckSourceDirectory(check) {
		this.#projectDirCheck = Boolean(check);
	}

	/* { inputPath, outputPath } though outputPath is *not* the full path: just the output directory */
	getPath() {
		return this.rawPath;
	}

	async getOutputPath(inputFileFromGlob) {
		let { inputDir, outputDir, outputPath, inputPath } = this;

		if (outputPath === true) {
			// no explicit target, implied target
			if (this.isDirectory(inputPath)) {
				let inputRelativePath = TemplatePath.stripLeadingSubPath(
					inputFileFromGlob || inputPath,
					inputDir,
				);
				return ProjectDirectories.normalizeDirectory(
					TemplatePath.join(outputDir, inputRelativePath),
				);
			}

			return TemplatePath.normalize(
				TemplatePath.join(
					outputDir,
					TemplatePath.stripLeadingSubPath(inputFileFromGlob || inputPath, inputDir),
				),
			);
		}

		if (inputFileFromGlob) {
			return this.getOutputPathForGlobFile(inputFileFromGlob);
		}

		// Has explicit target

		// Bug when copying incremental file overwriting output directory (and making it a file)
		// e.g. public/test.css -> _site
		// https://github.com/11ty/eleventy/issues/2278
		let fullOutputPath = TemplatePath.normalize(TemplatePath.join(outputDir, outputPath));
		if (outputPath === "" || this.isDirectory(inputPath)) {
			fullOutputPath = ProjectDirectories.normalizeDirectory(fullOutputPath);
		}

		// TODO room for improvement here:
		if (
			!this.#isInputPathGlob &&
			this.isExists(inputPath) &&
			!this.isDirectory(inputPath) &&
			this.isDirectory(fullOutputPath)
		) {
			let filename = path.parse(inputPath).base;
			return TemplatePath.normalize(TemplatePath.join(fullOutputPath, filename));
		}

		return fullOutputPath;
	}

	async getOutputPathForGlobFile(inputFileFromGlob) {
		return TemplatePath.join(
			await this.getOutputPath(),
			TemplatePath.getLastPathSegment(inputFileFromGlob),
		);
	}

	setDryRun(isDryRun) {
		this.isDryRun = Boolean(isDryRun);
	}

	setRunMode(runMode) {
		this.runMode = runMode;
	}

	setFileSystemSearch(fileSystemSearch) {
		this.fileSystemSearch = fileSystemSearch;
	}

	async getFiles(glob) {
		debug("Searching for: %o", glob);
		let b = this.benchmarks.aggregate.get("Searching the file system (passthrough)");
		b.before();

		if (!this.fileSystemSearch) {
			throw new Error("Internal error: Missing `fileSystemSearch` property.");
		}

		// TODO perf this globs once per addPassthroughCopy entry
		let files = TemplatePath.addLeadingDotSlashArray(
			await this.fileSystemSearch.search("passthrough", glob, {
				ignore: [
					// *only* ignores output dir (not node_modules!)
					this.outputDir,
				],
			}),
		);
		b.after();
		return files;
	}

	isExists(filePath) {
		return this.templateConfig.existsCache.exists(filePath);
	}

	isDirectory(filePath) {
		return this.templateConfig.existsCache.isDirectory(filePath);
	}

	// dir is guaranteed to exist by context
	// dir may not be a directory
	normalizeIfDirectory(input) {
		if (typeof input === "string") {
			if (input.endsWith(path.sep) || input.endsWith("/")) {
				return input;
			}

			// When inputPath is a directory, make sure it has a slash for passthrough copy aliasing
			// https://github.com/11ty/eleventy/issues/2709
			if (this.isDirectory(input)) {
				return `${input}/`;
			}
		}

		return input;
	}

	// maps input paths to output paths
	async getFileMap() {
		if (this.#isAlreadyNormalized) {
			return [
				{
					inputPath: this.inputPath,
					outputPath: this.outputPath,
				},
			];
		}

		// TODO VirtualFileSystem candidate
		if (!isDynamicPattern(this.inputPath) && this.isExists(this.inputPath)) {
			return [
				{
					inputPath: this.inputPath,
					outputPath: await this.getOutputPath(),
				},
			];
		}

		let paths = [];
		// If not directory or file, attempt to get globs
		let files = await this.getFiles(this.inputPath);
		for (let filePathFromGlob of files) {
			paths.push({
				inputPath: filePathFromGlob,
				outputPath: await this.getOutputPath(filePathFromGlob),
			});
		}

		return paths;
	}

	/* Types:
	 * 1. via glob, individual files found
	 * 2. directory, triggers an event for each file
	 * 3. individual file
	 */
	async copy(src, dest, copyOptions) {
		if (this.#projectDirCheck && !this.directories.isFileInProjectFolder(src)) {
			return Promise.reject(
				new TemplatePassthroughError(
					"Source file is not in the project directory. Check your passthrough paths.",
				),
			);
		}

		if (!this.directories.isFileInOutputFolder(dest)) {
			return Promise.reject(
				new TemplatePassthroughError(
					"Destination is not in the site output directory. Check your passthrough paths.",
				),
			);
		}

		let fileCopyCount = 0;
		let fileSizeCount = 0;
		let map = {};
		let b = this.benchmarks.aggregate.get("Passthrough Copy File");

		// returns a promise
		return copy(src, dest, copyOptions)
			.on(copy.events.COPY_FILE_START, (copyOp) => {
				// Access to individual files at `copyOp.src`
				map[copyOp.src] = copyOp.dest;
				b.before();
			})
			.on(copy.events.COPY_FILE_COMPLETE, (copyOp) => {
				fileCopyCount++;
				fileSizeCount += copyOp.stats.size;
				if (copyOp.stats.size > 5000000) {
					debug(
						`Copied %o (⚠️ large) file from %o`,
						readableFileSize(copyOp.stats.size),
						copyOp.src,
					);
				} else {
					debug(`Copied %o file from %o`, readableFileSize(copyOp.stats.size), copyOp.src);
				}
				b.after();
			})
			.then(
				() => {
					return {
						count: fileCopyCount,
						size: fileSizeCount,
						map,
					};
				},
				(error) => {
					if (copyOptions.overwrite === false && error.code === "EEXIST") {
						// just ignore if the output already exists and overwrite: false
						debug("Overwrite error ignored: %O", error);
						return {
							count: 0,
							size: 0,
							map,
						};
					}

					return Promise.reject(error);
				},
			);
	}

	async write() {
		if (this.isDryRun) {
			return Promise.resolve({
				count: 0,
				map: {},
			});
		}

		debug("Copying %o", this.inputPath);
		let fileMap = await this.getFileMap();

		// default options for recursive-copy
		// see https://www.npmjs.com/package/recursive-copy#arguments
		let copyOptionsDefault = {
			overwrite: true, // overwrite output. fails when input is directory (mkdir) and output is file
			dot: true, // copy dotfiles
			junk: false, // copy cache files like Thumbs.db
			results: false,
			expand: false, // follow symlinks (matches recursive-copy default)
			debug: false, // (matches recursive-copy default)

			// Note: `filter` callback function only passes in a relative path, which is unreliable
			// See https://github.com/timkendrick/recursive-copy/blob/4c9a8b8a4bf573285e9c4a649a30a2b59ccf441c/lib/copy.js#L59
			// e.g. `{ filePaths: [ './img/coolkid.jpg' ], relativePaths: [ '' ] }`
		};

		let copyOptions = Object.assign(copyOptionsDefault, this.copyOptions);

		let promises = fileMap.map((entry) => {
			// For-free passthrough copy
			if (checkPassthroughCopyBehavior(this.config, this.runMode)) {
				let aliasMap = {};
				aliasMap[entry.inputPath] = entry.outputPath;

				return Promise.resolve({
					count: 0,
					map: aliasMap,
				});
			}

			// Copy the files (only in build mode)
			return this.copy(entry.inputPath, entry.outputPath, copyOptions);
		});

		// IMPORTANT: this returns an array of promises, does not await for promise to finish
		return Promise.all(promises).then(
			(results) => {
				// collate the count and input/output map results from the array.
				let count = 0;
				let size = 0;
				let map = {};

				for (let result of results) {
					count += result.count;
					size += result.size;
					Object.assign(map, result.map);
				}

				return {
					count,
					size,
					map,
				};
			},
			(err) => {
				throw new TemplatePassthroughError(`Error copying passthrough files: ${err.message}`, err);
			},
		);
	}
}

export default TemplatePassthrough;
