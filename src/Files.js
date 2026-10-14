import { readFileSync } from "node:fs";

import { TemplatePath } from "@11ty/eleventy-utils";

import { createDebug } from "./Util/DebugLogUtil.js";
import DirContains from "./Util/DirContains.js";
import TemplateGlob from "./TemplateGlob.js";
import checkPassthroughCopyBehavior from "./Util/PassthroughCopyBehaviorCheck.js";

const debug = createDebug("Files");

export class Files {
	#extensionMap;
	#watcherGlobs;

	constructor(formats, templateConfig) {
		if (!templateConfig) {
			throw new Error("Internal error: Missing `templateConfig`` argument.");
		}

		this.templateConfig = templateConfig;
		this.config = templateConfig.getConfig();
		this.aggregateBench = this.config.benchmarkManager.get("Aggregate");

		this.formats = formats;
		this.eleventyIgnoreContent = false;
	}

	get dirs() {
		return this.templateConfig.directories;
	}

	get inputDir() {
		return this.dirs.input;
	}

	get outputDir() {
		return this.dirs.output;
	}

	get includesDir() {
		return this.dirs.includes;
	}

	get layoutsDir() {
		return this.dirs.layouts;
	}

	get dataDir() {
		return this.dirs.data;
	}

	// Backwards compat
	getDataDir() {
		return this.dataDir;
	}

	setFileSystemSearch(fileSystemSearch) {
		this.fileSystemSearch = fileSystemSearch;
	}

	init() {
		if (this.dirs.inputFile || this.dirs.inputGlob) {
			this.templateGlobs = TemplateGlob.map([this.dirs.inputFile || this.dirs.inputGlob]);
		} else {
			// Input is a directory
			this.templateGlobs = this.extensionMap.getGlobs(this.inputDir);
		}

		this.setupGlobs();
	}

	#getWatcherGlobs() {
		if (!this.#watcherGlobs) {
			let globs;
			// Input is a file
			if (this.inputFile) {
				globs = this.templateGlobs;
			} else {
				// input is a directory
				globs = this.extensionMap.getValidGlobs(this.inputDir);
			}
			this.#watcherGlobs = globs;
		}

		return this.#watcherGlobs;
	}

	get passthroughGlobs() {
		let paths = new Set();
		// stuff added in addPassthroughCopy()
		for (let path of this.passthroughManager.getConfigPathGlobs()) {
			paths.add(path);
		}
		// non-template language extensions
		for (let path of this.extensionMap.getPassthroughCopyGlobs(this.inputDir)) {
			paths.add(path);
		}
		return Array.from(paths);
	}

	restart() {
		this.setupGlobs();
		this._glob = null;
	}

	/* For testing */
	_setConfig(config) {
		if (!config.ignores) {
			config.ignores = new Set();
			config.ignores.add("**/node_modules/**");
		}

		this.config = config;

		this.init();
	}

	/* Set command root for local project paths */
	// This is only used by tests
	_setLocalPathRoot(dir) {
		this.localPathRoot = dir;
	}

	set extensionMap(extensionMap) {
		this.#extensionMap = extensionMap;
	}

	get extensionMap() {
		// for tests
		if (!this.#extensionMap) {
			throw new Error("Internal error: missing `extensionMap` in EleventyFiles.");
		}
		return this.#extensionMap;
	}

	setRunMode(runMode) {
		this.runMode = runMode;
	}

	setPassthroughManager(mgr) {
		this.passthroughManager = mgr;
	}

	set templateData(templateData) {
		this._templateData = templateData;
	}

	get templateData() {
		return this._templateData;
	}

	setupGlobs() {
		this.fileIgnores = this.getIgnores();
		this.extraIgnores = this.getIncludesAndDataDirs();
		this.uniqueIgnores = this.getIgnoreGlobs();

		// Conditional added for tests that don’t have a config
		if (this.config?.events) {
			this.config.events.emit("buildawesome.ignores", this.uniqueIgnores);
		}

		this.normalizedTemplateGlobs = this.templateGlobs;
	}

	normalizeIgnoreEntry(entry) {
		if (!entry.startsWith("**/")) {
			return TemplateGlob.normalizePath(this.localPathRoot || ".", entry);
		}
		return entry;
	}

	getIgnoreGlobs() {
		let uniqueIgnores = new Set();
		for (let ignore of this.fileIgnores) {
			uniqueIgnores.add(ignore);
		}
		for (let ignore of this.extraIgnores) {
			uniqueIgnores.add(ignore);
		}

		// Placing the config ignores last here is important to the tests
		for (let ignore of this.config.ignores) {
			uniqueIgnores.add(this.normalizeIgnoreEntry(ignore));
		}

		return Array.from(uniqueIgnores);
	}

	// v4.0.0-alpha.8 swapped from static to use existsCache
	getFileIgnores(ignoreFiles) {
		if (!Array.isArray(ignoreFiles)) {
			ignoreFiles = [ignoreFiles];
		}

		let ignores = [];
		for (let ignorePath of ignoreFiles) {
			ignorePath = TemplatePath.normalize(ignorePath);

			if (this.templateConfig.existsCache.exists(ignorePath)) {
				let ignoreContent = readFileSync(ignorePath, "utf8");
				if (ignoreContent) {
					let dir = TemplatePath.getDirFromFilePath(ignorePath);
					ignores = ignores.concat(this.normalizeIgnoreContent(dir, ignoreContent));
				}
			}
		}

		ignores.forEach((path) => debug(`${ignoreFiles} ignoring: ${path}`));

		return ignores;
	}

	// v4.0.0-alpha.8 swapped from static to use existsCache
	normalizeIgnoreContent(dir, ignoreContent) {
		let ignores = [];

		if (ignoreContent) {
			ignores = ignoreContent
				.split("\n")
				.map((line) => {
					return line.trim();
				})
				.filter((line) => {
					if (line.charAt(0) === "!") {
						debug(
							">>> When processing .gitignore/.eleventyignore, Eleventy does not currently support negative patterns but encountered one:",
						);
						debug(">>>", line);
						debug(
							"Follow along at https://github.com/11ty/buildawesome/issues/693 to track support.",
						);
					}

					// empty lines or comments get filtered out
					return line.length > 0 && line.charAt(0) !== "#" && line.charAt(0) !== "!";
				})
				.map((line) => {
					let path = TemplateGlob.normalizePath(dir, "/", line);
					path = TemplatePath.addLeadingDotSlash(TemplatePath.relativePath(path));

					if (this.templateConfig.existsCache.isDirectory(path)) {
						return path + "/**";
					}
					return path;
				});
		}

		return ignores;
	}

	/* Tests only */
	_setEleventyIgnoreContent(content) {
		this.eleventyIgnoreContent = content;
	}

	getIgnores() {
		let files = new Set();

		for (let ignore of this.getFileIgnores(this.getIgnoreFiles())) {
			files.add(ignore);
		}

		// testing API
		if (this.eleventyIgnoreContent !== false) {
			files.add(this.eleventyIgnoreContent);
		}

		// Make sure output dir isn’t in the input dir (or it will ignore all input!)
		// input: . and output: . (skip ignore)
		// input: ./content and output . (skip ignore)
		// input: . and output: ./_site (add ignore)
		let outputContainsInputDir = DirContains(this.outputDir, this.inputDir);
		if (!outputContainsInputDir) {
			// both are already normalized in 3.0
			files.add(TemplateGlob.map(this.outputDir + "/**"));
		}

		return Array.from(files);
	}

	getIgnoreFiles() {
		let ignoreFiles = new Set();
		let rootDirectory = this.localPathRoot || ".";

		if (this.config.useGitIgnore) {
			ignoreFiles.add(TemplatePath.join(rootDirectory, ".gitignore"));
		}

		if (this.eleventyIgnoreContent === false) {
			let absoluteInputDir = TemplatePath.absolutePath(this.inputDir);
			ignoreFiles.add(TemplatePath.join(rootDirectory, ".eleventyignore"));

			if (rootDirectory !== absoluteInputDir) {
				ignoreFiles.add(TemplatePath.join(this.inputDir, ".eleventyignore"));
			}
		}

		return Array.from(ignoreFiles);
	}

	/* Backwards compat */
	getIncludesDir() {
		return this.includesDir;
	}

	/* Backwards compat */
	getLayoutsDir() {
		return this.layoutsDir;
	}

	getFileGlobs() {
		return this.normalizedTemplateGlobs;
	}

	getRawFiles() {
		return this.templateGlobs;
	}

	async getWatchPathCache() {
		// Issue #1325: make sure passthrough copy files are not included here
		if (!this.pathCache) {
			throw new Error("Watching requires `.getFiles()` to be called first in EleventyFiles");
		}

		let ret = [];
		// Filter out the passthrough copy paths.
		for (let path of this.pathCache) {
			if (
				this.extensionMap.isFullTemplateFilePath(path) &&
				(await this.extensionMap.shouldSpiderJavaScriptDependencies(path))
			) {
				ret.push(path);
			}
		}
		return ret;
	}

	_globSearch() {
		let globs = this.getFileGlobs();

		// returns a promise
		debug("Searching for: %o", globs);
		return this.fileSystemSearch.search("templates", globs, {
			ignore: this.uniqueIgnores,
		});
	}

	async getFiles() {
		let bench = this.aggregateBench.get("Searching the file system (templates)");
		bench.before();
		let globResults = await this._globSearch();
		let paths = TemplatePath.addLeadingDotSlashArray(globResults);
		bench.after();

		// Note 2.0.0-canary.19 removed a `filter` option for custom template syntax here that was unpublished and unused.
		this.pathCache = paths;

		return paths;
	}

	getIncrementalFileShapes(paths, incrementalFilePaths) {
		if (!incrementalFilePaths || incrementalFilePaths.length === 0) {
			return {};
		}

		let passthroughIncrementalPaths = this.passthroughManager.filterToPassthroughCopyFilesOnly(
			paths,
			incrementalFilePaths,
		);
		let shapes = {};

		for (let incrementalFilePath of incrementalFilePaths) {
			if (passthroughIncrementalPaths.includes(incrementalFilePath)) {
				shapes[incrementalFilePath] = "copy";
			} else if (paths.includes(incrementalFilePath)) {
				shapes[incrementalFilePath] = "template";
			}
			// otherwise: include/layout/unknown
		}

		return shapes;
	}

	/* For `eleventy --watch` */
	getGlobWatcherFiles() {
		let directoryGlobs = this.getIncludesAndDataDirs();

		let globs = this.#getWatcherGlobs();

		if (checkPassthroughCopyBehavior(this.config, this.runMode)) {
			return globs.concat(directoryGlobs);
		}

		// Revert to old passthroughcopy copy files behavior
		return globs.concat(this.passthroughGlobs).concat(directoryGlobs);
	}

	/* For `eleventy --watch` */
	getGlobWatcherFilesForPassthroughCopy() {
		return this.passthroughGlobs;
	}

	/* For `eleventy --watch` */
	getGlobWatcherTemplateDataFiles() {
		return this.templateData.getTemplateDataFileGlob();
	}

	/* For `eleventy --watch` */
	// Improvement: Move this up the pipeline and feed into the ExistsCache to alleviate TemplateData checks
	async getWatcherTemplateJavaScriptDataFiles() {
		let globs = this.templateData.getTemplateJavaScriptDataFileGlob();
		let bench = this.aggregateBench.get("Searching the file system (watching)");
		bench.before();

		let results = TemplatePath.addLeadingDotSlashArray(
			await this.fileSystemSearch.search("js-dependencies", globs, {
				ignore: [
					"**/node_modules/**",
					".git/**",
					// TODO outputDir
					// this.outputDir,
				],
			}),
		);
		bench.after();

		return results;
	}

	/* Ignored by `eleventy --watch` */
	getGlobWatcherIgnores() {
		// convert to format without ! since they are passed in as a separate argument to glob watcher
		let entries = new Set(
			this.fileIgnores.map((ignore) => TemplatePath.stripLeadingDotSlash(ignore)),
		);

		for (let ignore of this.config.watchIgnores) {
			entries.add(this.normalizeIgnoreEntry(ignore));
		}

		// de-duplicated
		return Array.from(entries);
	}

	getIncludesAndDataDirs() {
		let rawPaths = new Set();
		rawPaths.add(this.includesDir);
		if (this.layoutsDir) {
			rawPaths.add(this.layoutsDir);
		}
		rawPaths.add(this.dataDir);

		return Array.from(rawPaths)
			.filter((entry) => {
				// never ignore the input directory (even if config file returns "" for these)
				return entry && entry !== this.inputDir;
			})
			.map((entry) => {
				return TemplateGlob.map(entry + "**");
			});
	}
}
