import { TemplatePath, isPlainObject } from "@11ty/eleventy-utils";

import Template from "./Template.js";
import TemplateMap from "./TemplateMap.js";
import BaseError from "./Errors/BaseError.js";
import ErrorUtil from "./Errors/ErrorUtil.js";
import { createDebug } from "./Util/DebugLogUtil.js";

const debug = createDebug("TemplateWriter");

class TemplateWriterMissingConfigArgError extends BaseError {}
class PassthroughCopyError extends BaseError {}
class TemplateError extends BaseError {}

class TemplateWriter {
	#eleventyFiles;
	#passthroughManager;
	#errorHandler;
	#logger;
	#extensionMap;
	#incrementalFiles = [];

	constructor(
		templateFormats, // TODO remove this in favor of this.#eleventyFiles
		templateData,
		templateConfig,
	) {
		if (!templateConfig) {
			throw new TemplateWriterMissingConfigArgError("Missing config argument.");
		}
		this.templateConfig = templateConfig;
		this.config = templateConfig.getConfig();
		this.userConfig = templateConfig.userConfig;

		this.templateFormats = templateFormats;

		this.templateData = templateData;
		this.isDryRun = false;
		this.writeCount = 0;
		this.renderCount = 0;
		this.skippedCount = 0;
		this.isRunInitialBuild = true;

		this._templatePathCache = new Map();
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

	get templateFormats() {
		return this._templateFormats;
	}

	set templateFormats(value) {
		this._templateFormats = value;
	}

	/* Getter for error handler */
	get errorHandler() {
		if (!this.#errorHandler) {
			throw new Error("Internal error: missing ErrorHandler instance.");
		}

		return this.#errorHandler;
	}

	get logger() {
		if (!this.#logger) {
			throw new Error("Internal error: missing ConsoleLogger instance.");
		}

		return this.#logger;
	}

	set logger(logger) {
		this.#logger = logger;
	}

	/* For testing */
	overrideConfig(config) {
		this.config = config;
	}

	restart() {
		this.writeCount = 0;
		this.renderCount = 0;
		this.skippedCount = 0;
	}

	set extensionMap(extensionMap) {
		this.#extensionMap = extensionMap;
	}

	get extensionMap() {
		if (!this.#extensionMap) {
			throw new Error("Internal error: missing `extensionMap` in TemplateWriter.");
		}
		return this.#extensionMap;
	}

	setPassthroughManager(mgr) {
		this.#passthroughManager = mgr;
	}

	setEleventyFiles(eleventyFiles) {
		this.#eleventyFiles = eleventyFiles;
	}

	// Tests
	getPassthroughGlobs() {
		return this.#eleventyFiles?.passthroughGlobs;
	}

	getPathsWithVirtualTemplates(paths) {
		// Support for virtual templates added in 3.0
		if (this.config.virtualTemplates && isPlainObject(this.config.virtualTemplates)) {
			let virtualTemplates = Object.keys(this.config.virtualTemplates)
				.filter((path) => {
					// Filter out includes/layouts
					return this.dirs.isTemplateFile(path);
				})
				.map((path) => {
					let fullVirtualPath = this.dirs.getInputPath(path);
					if (!this.extensionMap.getKey(fullVirtualPath)) {
						throw new Error(
							`The virtual template at ${fullVirtualPath} is using a template format that’s not valid for your project. Your project is using: "${this.formats}". Read more about formats: https://v3.11ty.dev/docs/config/#template-formats`,
						);
					}
					return fullVirtualPath;
				});

			paths = paths.concat(virtualTemplates);

			// Virtual templates can not live at the same place as files on the file system!
			if (paths.length !== new Set(paths).size) {
				let conflicts = {};
				for (let path of paths) {
					if (conflicts[path]) {
						throw new Error(
							`A virtual template had the same path as a file on the file system: "${path}"`,
						);
					}

					conflicts[path] = true;
				}
			}
		}

		return paths;
	}

	async _getAllPaths() {
		if (!this.#eleventyFiles) {
			return this.getPathsWithVirtualTemplates([]);
		}

		// this is now cached upstream by FileSystemSearch
		let paths = await this.#eleventyFiles.getFiles();
		paths = this.getPathsWithVirtualTemplates(paths);
		return paths;
	}

	createTemplate(path, to = "fs") {
		let tmpl = this._templatePathCache.get(path);
		let wasCached = false;

		if (tmpl) {
			wasCached = true;
			// Update config for https://github.com/11ty/eleventy/issues/3468
			// TODO reset other constructor things here like inputDir/outputDir
			tmpl.resetCachedTemplate({
				templateData: this.templateData,
				extensionMap: this.extensionMap,
				eleventyConfig: this.templateConfig,
			});
		} else {
			tmpl = new Template(path, this.templateData, this.extensionMap, this.templateConfig);
			tmpl.setOutputFormat(to);
			tmpl.logger = this.logger;
			this._templatePathCache.set(path, tmpl);
		}

		tmpl.setTransforms(this.config.transforms);
		tmpl.setPreprocessors(this.config.preprocessors);
		tmpl.setLinters(this.config.linters);
		tmpl.setDryRun(this.isDryRun);
		tmpl.reset();

		return {
			template: tmpl,
			wasCached,
		};
	}

	// incrementalFileShape is `template` or `copy` (for passthrough file copy)
	async #addToTemplateMapIncrementalBuild(incrementalFileShapes, paths, to = "fs") {
		// Render overrides are only used when `--ignore-initial` is in play and an initial build is not run
		let ignoreInitialBuild = !this.isRunInitialBuild;
		let secondOrderRelevantLookup = {};
		let templates = [];
		let cacheResetTracker = new Set();

		let promises = [];
		for (let path of paths) {
			let { template: tmpl } = this.createTemplate(path, to);

			// Note: removed a fix here to fetch missing templateRender instances
			// that was tested as no longer needed (Issue #3170)
			// Related: #3870, improved configuration reset

			templates.push(tmpl);

			// required for tmpl.isFileRelevantToThisTemplate below
			await tmpl.asyncTemplateInitialization();

			// This must happen before data is generated for the incremental file only
			if (
				(incrementalFileShapes[path] === "template" &&
					this.#incrementalFiles.includes(tmpl.inputPath)) ||
				// Issue #3824 #3870
				this.#incrementalFiles.find((p) =>
					tmpl.isFileRelevantToThisTemplate(p, {
						isFullTemplate: incrementalFileShapes[p] === "template",
					}),
				)
			) {
				cacheResetTracker.add(tmpl.inputPath);
				tmpl.resetCaches();
			}

			// IMPORTANT: This is where the data is first generated for the template
			promises.push(this.templateMap.add(tmpl));
		}

		// Important to set up template dependency relationships first
		await Promise.all(promises);

		// Delete incremental file from the dependency graph so we get fresh entries!
		// This _must_ happen before any additions, the other ones are in Custom.js and GlobalDependencyMap.js (from the eleventy.layouts Event)
		for (let p of this.#incrementalFiles) {
			this.config.uses.resetNode(p);
		}

		// write new template relationships to the global dependency graph for next time
		this.templateMap.addAllToGlobalDependencyGraph();

		// Always disable render for --ignore-initial
		if (ignoreInitialBuild) {
			for (let tmpl of templates) {
				tmpl.setRenderableOverride(false); // disable render
			}
			return;
		}

		for (let tmpl of templates) {
			if (
				incrementalFileShapes[tmpl.inputPath] === "template" &&
				this.#incrementalFiles.includes(tmpl.inputPath)
			) {
				tmpl.setRenderableOverride(undefined); // unset, probably render
			} else if (
				this.#incrementalFiles.find((p) =>
					tmpl.isFileRelevantToThisTemplate(p, {
						isFullTemplate: incrementalFileShapes[p] === "template",
					}),
				)
			) {
				// changed file is used by template
				// template uses the changed file
				tmpl.setRenderableOverride(undefined); // unset, probably render
				secondOrderRelevantLookup[tmpl.inputPath] = true;
			} else if (this.config.uses.areFilesUsedBy(this.#incrementalFiles, tmpl.inputPath)) {
				// changed file uses this template
				tmpl.setRenderableOverride("optional");
			} else {
				// For incremental, always disable render on irrelevant templates
				tmpl.setRenderableOverride(false); // disable render
			}
		}

		let secondOrderRelevantArray = this.config.uses
			.getTemplatesRelevantToTemplateList(Object.keys(secondOrderRelevantLookup))
			.map((entry) => TemplatePath.addLeadingDotSlash(entry));
		let secondOrderTemplates = Object.fromEntries(
			Object.entries(secondOrderRelevantArray).map(([index, value]) => [value, true]),
		);

		for (let tmpl of templates) {
			// second order templates must also be rendered if not yet already rendered at least once and available in cache.
			if (secondOrderTemplates[tmpl.inputPath]) {
				if (tmpl.isRenderableDisabled()) {
					tmpl.setRenderableOverride("optional");
				}
			}
		}

		// Order of templates does not matter here, they’re reordered later based on dependencies in TemplateMap.js
		for (let tmpl of templates) {
			if (
				incrementalFileShapes[tmpl.inputPath] === "template" &&
				this.#incrementalFiles.includes(tmpl.inputPath)
			) {
				// Cache is reset above (to invalidate data cache at the right time)
				tmpl.setDryRunViaIncremental(false);
			} else if (!tmpl.isRenderableDisabled() && !tmpl.isRenderableOptional()) {
				if (!cacheResetTracker.has(tmpl.inputPath)) {
					// Related to the template but not the template (reset the render cache, not the read cache)
					tmpl.resetCaches({
						render: true,
					});
				}

				tmpl.setDryRunViaIncremental(false);
			} else {
				// During incremental we don’t reset cache here, keep cache for read/reader (data cache is always reset elsewhere), see https://github.com/11ty/eleventy/issues/2710
				tmpl.setDryRunViaIncremental(true);

				this.skippedCount++;
			}
		}
	}

	async #addToTemplateMapFullBuild(paths, to = "fs") {
		if (this.#incrementalFiles?.length > 0) {
			throw new Error("Internal error: improper mixing of full build and incremental builds.");
		}

		let ignoreInitialBuild = !this.isRunInitialBuild;
		let promises = [];
		for (let path of paths) {
			let { template: tmpl, wasCached } = this.createTemplate(path, to);
			// Render overrides are only used when `--ignore-initial` is in play and an initial build is not run
			if (ignoreInitialBuild) {
				tmpl.setRenderableOverride(false); // disable render
			} else {
				tmpl.setRenderableOverride(undefined); // unset, render
			}

			if (wasCached) {
				tmpl.resetCaches();
			}

			// IMPORTANT: This is where the data is first generated for the template
			promises.push(this.templateMap.add(tmpl));
		}

		await Promise.all(promises);

		// write new template relationships to the global dependency graph for next time
		this.templateMap.addAllToGlobalDependencyGraph();
	}

	getIncrementalFileShapes(paths) {
		// browser-based fork
		if (!this.#eleventyFiles) {
			let shapes = {};
			for (let incFile of this.#incrementalFiles) {
				// this is an assumption for browser-based Eleventy only
				shapes[incFile] = "template";
			}
			return shapes;
		}

		return this.#eleventyFiles?.getIncrementalFileShapes(paths, this.#incrementalFiles);
	}

	async #addToTemplateMap(paths, to = "fs") {
		let incrementalFileShapes = this.getIncrementalFileShapes(paths);

		// Filter out passthrough copy files
		paths = paths.filter((path) => {
			if (!this.extensionMap.hasEngine(path)) {
				return false;
			}

			if (incrementalFileShapes[path] === "copy") {
				this.skippedCount++;
				// Filters out templates if the incremental file is a passthrough copy file
				return false;
			}

			return true;
		});

		if (this.#incrementalFiles?.length > 0) {
			await this.#addToTemplateMapIncrementalBuild(incrementalFileShapes, paths, to);
		} else {
			await this.#addToTemplateMapFullBuild(paths, to);
		}
	}

	async createTemplateMap(paths, to) {
		this.templateMap = new TemplateMap(this.templateConfig);

		await this.#addToTemplateMap(paths, to);
		await this.templateMap.cache();

		// Return is used by tests
		return this.templateMap;
	}

	async #generateTemplate(mapEntry, to) {
		let tmpl = mapEntry.template;

		return tmpl.generateMapEntry(mapEntry, to).then((pages) => {
			this.renderCount += tmpl.getRenderCount();
			this.writeCount += tmpl.getWriteCount();
			return pages;
		});
	}

	async writePassthroughCopy(templateExtensionPaths) {
		if (!this.#passthroughManager) {
			throw new Error("Internal error: Missing `passthroughManager` instance.");
		}

		return this.#passthroughManager.copyAll(templateExtensionPaths).catch((e) => {
			this.errorHandler.warn(e, "Error with passthrough copy");
			return Promise.reject(new PassthroughCopyError("Having trouble copying", e));
		});
	}

	async generateTemplates(paths, to = "fs") {
		let promises = [];
		// TODO optimize await here
		await this.createTemplateMap(paths, to);
		debug("Template map created.");

		let usedTemplateContentTooEarlyMap = [];
		for (let mapEntry of this.templateMap.getMap()) {
			promises.push(
				this.#generateTemplate(mapEntry, to).catch(function (e) {
					// Premature templateContent in layout render, this also happens in
					// TemplateMap.populateContentDataInMap for non-layout content
					if (ErrorUtil.isPrematureTemplateContentError(e)) {
						usedTemplateContentTooEarlyMap.push(mapEntry);
					} else {
						let outputPaths = `"${mapEntry._pages.map((page) => page.outputPath).join(`", "`)}"`;
						return Promise.reject(
							new TemplateError(
								`Having trouble writing to ${outputPaths} from "${mapEntry.inputPath}"`,
								e,
							),
						);
					}
				}),
			);
		}

		for (let mapEntry of usedTemplateContentTooEarlyMap) {
			promises.push(
				this.#generateTemplate(mapEntry, to).catch(function (e) {
					return Promise.reject(
						new TemplateError(
							`Having trouble writing to (second pass) "${mapEntry.outputPath}" from "${mapEntry.inputPath}"`,
							e,
						),
					);
				}),
			);
		}

		return promises;
	}

	// Similiar to `write()` but skips passthrough copy
	async writeTemplates() {
		let paths = await this._getAllPaths();

		return Promise.all(await this.generateTemplates(paths)).then(
			(templateResults) => {
				return {
					// New in 3.0: flatten and filter out falsy templates
					templates: templateResults.flat().filter(Boolean),
				};
			},
			(e) => {
				return Promise.reject(e);
			},
		);
	}

	async write() {
		let paths = await this._getAllPaths();

		// This must happen before writePassthroughCopy
		this.templateConfig.userConfig.emit("buildawesome#beforerender");

		let aggregatePassthroughCopyPromise = this.writePassthroughCopy(paths);

		let templatesPromise = Promise.all(await this.generateTemplates(paths)).then((results) => {
			this.templateConfig.userConfig.emit("buildawesome#render");

			return results;
		});

		return Promise.all([aggregatePassthroughCopyPromise, templatesPromise]).then(
			async ([passthroughCopyResults, templateResults]) => {
				return {
					passthroughCopy: passthroughCopyResults,
					// New in 3.0: flatten and filter out falsy templates
					templates: templateResults.flat().filter(Boolean),
				};
			},
			(e) => {
				return Promise.reject(e);
			},
		);
	}

	// Passthrough copy not supported in JSON output.
	// --incremental not supported in JSON output.
	async getJSON(to = "json") {
		let paths = await this._getAllPaths();
		let promises = await this.generateTemplates(paths, to);

		return Promise.all(promises).then(
			(templateResults) => {
				return {
					// New in 3.0: flatten and filter out falsy templates
					templates: templateResults.flat().filter(Boolean),
				};
			},
			(e) => {
				return Promise.reject(e);
			},
		);
	}

	setDryRun(isDryRun) {
		this.isDryRun = Boolean(isDryRun);
	}

	setRunInitialBuild(runInitialBuild) {
		this.isRunInitialBuild = runInitialBuild;
	}

	setIncrementalFiles(files = []) {
		this.#incrementalFiles = files;
		this.#passthroughManager?.setIncrementalFiles(files);
	}
	resetIncremental() {
		this.#incrementalFiles = [];
		this.#passthroughManager?.resetIncremental();
	}

	getMetadata() {
		return {
			// copyCount, copySize
			...(this.#passthroughManager?.getMetadata() || {}),
			skipCount: this.skippedCount,
			writeCount: this.writeCount,
			renderCount: this.renderCount,
		};
	}

	get caches() {
		return ["_templatePathCache"];
	}
}

export default TemplateWriter;
