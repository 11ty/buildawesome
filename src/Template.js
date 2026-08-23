import { parse } from "node:path";
import { statSync } from "node:fs";

import lodash from "@11ty/lodash-custom";
import { Merge, TemplatePath, isPlainObject } from "@11ty/eleventy-utils";

import chalk from "./Adapters/Packages/chalk.js";
import { createDebug } from "./Util/DebugLogUtil.js";
import { getCreatedTimestamp, getUpdatedTimestamp } from "./Util/Git.js";
import TemplateContent from "./TemplateContent.js";
import TemplatePermalink from "./TemplatePermalink.js";
import TemplateLayout from "./TemplateLayout.js";
import TemplateFileSlug from "./TemplateFileSlug.js";
import ComputedData from "./Data/ComputedData.js";
import Pagination from "./Plugins/Pagination.js";
import TemplateBehavior from "./TemplateBehavior.js";
import TemplateContentPrematureUseError from "./Errors/TemplateContentPrematureUseError.js";
import TemplateContentUnrenderedTemplateError from "./Errors/TemplateContentUnrenderedTemplateError.js";
import BaseError from "./Errors/BaseError.js";
import { fromISOtoDateUTC } from "./Util/DateParse.js";
import ReservedData from "./Util/ReservedData.js";
import TransformsUtil from "./Util/TransformsUtil.js";
import { FileSystemUtilities } from "./Util/FileSystemUtilities.js";
import { TemplatePreprocessors } from "./TemplatePreprocessors.js";
import { getDirectoryFromUrl } from "./Util/UrlUtil.js";
import { ResolveConfigurationData } from "./Data/ResolveConfigurationData.js";

const { set: lodashSet, get: lodashGet } = lodash;

const debug = createDebug("Template");

class Template extends TemplateContent {
	#logger;
	#fsManager;
	#stats;
	#dataCache;

	#cacheRenderedPromise;
	#cacheRenderedTransformsAndLayoutsPromise;
	#preprocessors;
	#preprocessorCache;

	constructor(templatePath, templateData, extensionMap, config) {
		super(templatePath, config);

		this.parsed = parse(templatePath);

		// for pagination
		this.extraOutputSubdirectory = "";

		this.extensionMap = extensionMap;
		this.templateData = templateData;
		this.#initFileSlug();

		this.linters = [];
		this.transforms = {};

		this.isDryRun = false;
		this.writeCount = 0;

		this.fileSlug = new TemplateFileSlug(this.inputPath, this.extensionMap, this.eleventyConfig);
		this.fileSlugStr = this.fileSlug.getSlug();
		this.filePathStem = this.fileSlug.getFullPathWithoutExtension();

		this.outputFormat = "fs";

		this.behavior = new TemplateBehavior(this.config);
		this.behavior.setOutputFormat(this.outputFormat);
	}

	#initFileSlug() {
		this.fileSlug = new TemplateFileSlug(this.inputPath, this.extensionMap, this.eleventyConfig);
		this.fileSlugStr = this.fileSlug.getSlug();
		this.filePathStem = this.fileSlug.getFullPathWithoutExtension();
	}

	/* mimic constructor arg order */
	resetCachedTemplate({ templateData, extensionMap, eleventyConfig }) {
		super.resetCachedTemplate({ eleventyConfig });
		this.templateData = templateData;
		this.extensionMap = extensionMap;
		// this.#fsManager = undefined;
		this.#initFileSlug();
	}

	get fsManager() {
		if (!this.#fsManager) {
			this.#fsManager = new FileSystemUtilities(this.eleventyConfig);
		}
		return this.#fsManager;
	}

	get logger() {
		if (!this.#logger) {
			throw new Error("Internal error: missing ConsoleLogger instance.");
		}
		return this.#logger;
	}

	/* Setter for Logger */
	set logger(logger) {
		this.#logger = logger;
	}

	isRenderable() {
		return this.behavior.isRenderable();
	}

	isRenderableDisabled() {
		return this.behavior.isRenderableDisabled();
	}

	isRenderableOptional() {
		// A template that is lazily rendered once if used by a second order dependency of another template dependency.
		// e.g. You change firstpost.md, which is used by feed.xml, but secondpost.md (also used by feed.xml)
		// has not yet rendered and needs to be rendered once to populate the cache.
		return this.behavior.isRenderableOptional();
	}

	setRenderableOverride(renderableOverride) {
		this.behavior.setRenderableOverride(renderableOverride);
	}

	reset() {
		// *always* runs once per build (even though it’s called twice internally)
		this.#preprocessorCache = undefined;

		// *always* runs once per build
		this.#dataCache = undefined;

		this.renderCount = 0;
		this.writeCount = 0;
	}

	resetCaches(types) {
		types = this.getResetTypes(types);

		super.resetCaches(types);

		if (types.render) {
			this.#cacheRenderedPromise = undefined;
			this.#cacheRenderedTransformsAndLayoutsPromise = undefined;
		}
	}

	setOutputFormat(to) {
		this.outputFormat = to;
		this.behavior.setOutputFormat(to);
	}

	setDryRunViaIncremental(isIncremental) {
		this.isDryRun = isIncremental;
		this.isIncremental = isIncremental;
	}

	setDryRun(isDryRun) {
		this.isDryRun = !!isDryRun;
	}

	setExtraOutputSubdirectory(dir) {
		this.extraOutputSubdirectory = dir + "/";
	}

	getTemplateSubfolder() {
		let dir = TemplatePath.absolutePath(this.parsed.dir);
		let inputDir = TemplatePath.absolutePath(this.inputDir);

		// Browser virtual fs uses `/` root for absolute paths
		// Fixed in @11ty/eleventy-utils@2.0.8 or newer (can remove this later)
		if (inputDir === "/" && dir.startsWith("/")) {
			return dir;
		}

		return TemplatePath.stripLeadingSubPath(dir, inputDir);
	}

	templateUsesLayouts(pageData) {
		if (this.hasTemplateRender()) {
			return pageData?.[this.config.keys.layout] && this.templateRender.engine.useLayouts();
		}

		// If `layout` prop is set, default to true when engine is unknown
		return Boolean(pageData?.[this.config.keys.layout]);
	}

	getLayout(layoutKey) {
		// already cached downstream in TemplateLayout -> TemplateCache
		try {
			return TemplateLayout.getTemplate(layoutKey, this.eleventyConfig, this.extensionMap);
		} catch (e) {
			throw new BaseError(
				`Problem creating an Eleventy Layout for the "${this.inputPath}" template file.`,
				e,
			);
		}
	}

	get baseFile() {
		return this.extensionMap.removeTemplateExtension(this.parsed.base);
	}

	async _getLink(data) {
		if (!data) {
			throw new Error("Internal error: data argument missing in Template->_getLink");
		}

		let computedData = ResolveConfigurationData.getValue(data, this.config.keys.computed);
		let permalink =
			ResolveConfigurationData.getValue(data, this.config.keys.permalink) ??
			ResolveConfigurationData.getValue(computedData, this.config.keys.permalink);
		let permalinkValue;
		let isDynamicPermalinkEnabled =
			this.config.dynamicPermalinks && data.dynamicPermalink !== false;

		// `permalink: false` means render but no file system write, e.g. use in collections only)
		// `permalink: true` throws an error
		if (typeof permalink === "boolean") {
			permalinkValue = permalink;
		} else if (permalink && !isDynamicPermalinkEnabled) {
			// Issue #838
			permalinkValue = permalink;
		} else if (isPlainObject(permalink)) {
			// Empty permalink {} object should act as if no permalink was set at all
			// and inherit the default behavior
			let isEmptyObject = Object.keys(permalink).length === 0;
			if (!isEmptyObject) {
				let promises = [];
				let keys = [];
				for (let key in permalink) {
					keys.push(key);
					if (key !== "build" && Array.isArray(permalink[key])) {
						promises.push(
							Promise.all([...permalink[key]].map((entry) => super.renderPermalink(entry, data))),
						);
					} else {
						promises.push(super.renderPermalink(permalink[key], data));
					}
				}

				let results = await Promise.all(promises);

				permalinkValue = {};
				for (let j = 0, k = keys.length; j < k; j++) {
					let key = keys[j];
					permalinkValue[key] = results[j];
					debug(
						"Rendering permalink.%o for %o: %s becomes %o",
						key,
						this.inputPath,
						permalink[key],
						results[j],
					);
				}
			}
		} else if (permalink) {
			// render variables inside permalink front matter, bypass markdown
			permalinkValue = await super.renderPermalink(permalink, data);
			debug("Rendering permalink for %o: %s becomes %o", this.inputPath, permalink, permalinkValue);
		}

		// Override default permalink behavior. Only do this if permalink was _not_ in the data cascade
		if (!permalink && isDynamicPermalinkEnabled) {
			let tr = await this.getTemplateRender();
			let permalinkCompilation = tr.engine.permalinkNeedsCompilation("");
			if (typeof permalinkCompilation === "function") {
				let ret = await this._renderFunction(permalinkCompilation, permalinkValue, this.inputPath);
				if (ret !== undefined) {
					if (typeof ret === "function") {
						// function
						permalinkValue = await this._renderFunction(ret, data);
					} else {
						// scalar
						permalinkValue = ret;
					}
				}
			}
		}

		if (permalinkValue !== undefined) {
			let p = new TemplatePermalink(
				permalinkValue,
				this.extraOutputSubdirectory,
				isDynamicPermalinkEnabled,
			);
			p.setUrlTransforms(this.config.urlTransforms);
			this.behavior.setFromPermalink(p);
			return p;
		}

		// No `permalink` specified in data cascade, do the default
		let p = TemplatePermalink.generate(
			this.getTemplateSubfolder(),
			this.baseFile,
			this.extraOutputSubdirectory,
			this.engine.defaultTemplateFileExtension,
			isDynamicPermalinkEnabled,
		);
		p.setUrlTransforms(this.config.urlTransforms);
		return p;
	}

	async usePermalinkRoot() {
		// @cachedproperty
		if (this._usePermalinkRoot === undefined) {
			// TODO this only works with immediate front matter and not data files
			let { data } = await this.getFrontMatterData();
			this._usePermalinkRoot = data[this.config.keys.permalinkRoot];
		}

		return this._usePermalinkRoot;
	}

	async getOutputLocations(data) {
		this.bench.get("(count) getOutputLocations").incrementCount();
		let link = await this._getLink(data);

		let path;
		if (await this.usePermalinkRoot()) {
			path = link.toPathFromRoot();
		} else {
			path = link.toPath(this.outputDir);
		}

		let href = link.toHref();
		return {
			linkInstance: link,
			rawPath: link.toOutputPath(), // includes output directory
			href,
			path: path,
			dir: getDirectoryFromUrl(href), // for `page.dir`
		};
	}

	// This is likely now a test-only method
	// Preferred to use the singular `getOutputLocations` above.
	async getRawOutputPath(data) {
		this.bench.get("(count) getRawOutputPath").incrementCount();
		let link = await this._getLink(data);
		return link.toOutputPath();
	}

	// Preferred to use the singular `getOutputLocations` above.
	async getOutputHref(data) {
		this.bench.get("(count) getOutputHref").incrementCount();
		let link = await this._getLink(data);
		return link.toHref();
	}

	// Preferred to use the singular `getOutputLocations` above.
	async getOutputPath(data) {
		this.bench.get("(count) getOutputPath").incrementCount();
		let link = await this._getLink(data);
		if (await this.usePermalinkRoot()) {
			return link.toPathFromRoot();
		}
		return link.toPath(this.outputDir);
	}

	async _testGetAllLayoutFrontMatterData() {
		let { data: frontMatterData } = await this.getFrontMatterData();

		if (frontMatterData[this.config.keys.layout]) {
			let layout = this.getLayout(frontMatterData[this.config.keys.layout]);
			return await layout.getData();
		}
		return {};
	}

	async #getData() {
		let localData = {};
		let globalData = {};

		if (this.templateData) {
			localData = await this.templateData.getTemplateDirectoryData(this.inputPath);
			globalData = await this.templateData.getGlobalData();
		}

		let { data: frontMatterData } = await this.getFrontMatterData();

		let mergedLayoutData = {};
		let tr = await this.getTemplateRender();
		if (tr.engine.useLayouts()) {
			let layoutKey =
				frontMatterData[this.config.keys.layout] ||
				localData[this.config.keys.layout] ||
				globalData[this.config.keys.layout];

			// Layout front matter data
			if (layoutKey) {
				let layout = this.getLayout(layoutKey);

				mergedLayoutData = await layout.getData();
			}
		}

		try {
			let mergedData = Merge({}, globalData, mergedLayoutData, localData, frontMatterData);

			if (this.config.freezeReservedData) {
				ReservedData.checkSubset(mergedData);
			}

			let pageData = await this.getPageData(mergedData);

			Merge(mergedData, { page: pageData });

			return mergedData;
		} catch (e) {
			// if ReservedDataError, defer to that (from ReservedData.checkSubset above)
			if (!ReservedData.isReservedDataError(e) && ReservedData.isFrozenError(e)) {
				throw ReservedData.getError({ cause: e });
			}
			throw e;
		}
	}

	async getData() {
		if (!this.#dataCache) {
			// @cachedproperty
			this.#dataCache = this.#getData();
		}

		return this.#dataCache;
	}

	async getPageData(data) {
		let page = {
			// Make sure to keep these keys synchronized in src/Util/ReservedData.js
			inputPath: this.inputPath,
			fileSlug: this.fileSlugStr,
			filePathStem: this.filePathStem,
			outputFileExtension: this.engine.defaultTemplateFileExtension,
			templateSyntax: this.templateRender.getEnginesList(data[this.config.keys.engineOverride]),
		};

		let newDate = await this.getMappedDate(data?.date, page);
		// Skip date assignment if custom date is falsy.
		if (newDate) {
			page.date = newDate;
		}

		// page.url
		// page.outputPath
		// page.excerpt from gray-matter and Front Matter
		// page.lang from I18nPlugin

		return page;
	}

	// Tests only
	async render() {
		throw new Error("Internal error: `Template->render` was removed in Eleventy 3.0.");
	}

	// Tests only
	async renderLayout() {
		throw new Error("Internal error: `Template->renderLayout` was removed in Eleventy 3.0.");
	}

	async renderDirect(str, data, bypassMarkdown) {
		return super.render(str, data, bypassMarkdown);
	}

	// see also Eleventy->#resetFileInWatchQueue()
	internalTriggerTemplateModifiedPath(changedFilePath) {
		this.config.events.emit("buildawesome#templatemodified", changedFilePath);
	}

	// This is the primary render mechanism, called via TemplateMap->populateContentDataInMap
	async renderPageEntryWithoutLayout(pageEntry) {
		// @cachedproperty
		if (!this.#cacheRenderedPromise) {
			this.#cacheRenderedPromise = this.renderDirect(pageEntry.rawInput, pageEntry.data);
			this.renderCount++;
		}

		return this.#cacheRenderedPromise;
	}

	setLinters(linters) {
		if (!isPlainObject(linters)) {
			throw new Error("Object expected in setLinters");
		}
		// this acts as a reset
		this.linters = [];
		for (let linter of Object.values(linters).filter((l) => typeof l === "function")) {
			this.addLinter(linter);
		}
	}

	addLinter(callback) {
		this.linters.push(callback);
	}

	async runLinters(str, page) {
		let { inputPath, outputPath, url } = page;
		let pageData = page.data.page;

		for (let linter of this.linters) {
			// these can be asynchronous but no guarantee of order when they run
			linter.call(
				{
					inputPath,
					outputPath,
					url,
					page: pageData,
				},
				str,
				inputPath,
				outputPath,
			);
		}
	}

	setTransforms(transforms) {
		if (!isPlainObject(transforms)) {
			throw new Error("Object expected in setTransforms");
		}
		this.transforms = transforms;
	}

	async runTransforms(str, pageEntry) {
		return TransformsUtil.runAll(str, pageEntry.data.page, this.transforms, {
			logger: this.logger,
		});
	}

	async #renderComputedUnit(entry, data) {
		if (typeof entry === "string") {
			return this.renderComputedData(entry, data);
		}

		if (isPlainObject(entry)) {
			for (let key in entry) {
				entry[key] = await this.#renderComputedUnit(entry[key], data);
			}
		}

		if (Array.isArray(entry)) {
			for (let j = 0, k = entry.length; j < k; j++) {
				entry[j] = await this.#renderComputedUnit(entry[j], data);
			}
		}

		return entry;
	}

	_addComputedEntry(computedData, obj, parentKey, declaredDependencies) {
		// this check must come before isPlainObject
		if (typeof obj === "function") {
			computedData.add(parentKey, obj, declaredDependencies);
		} else if (Array.isArray(obj) || typeof obj === "string") {
			// Arrays are treated as one entry in the dependency graph now, Issue #3728
			computedData.addTemplateString(
				parentKey,
				async function (innerData) {
					return this.tmpl.#renderComputedUnit(obj, innerData);
				},
				declaredDependencies,
				this.getParseForSymbolsFunction(obj),
				this,
			);
		} else if (isPlainObject(obj)) {
			// Arrays used to be computed here
			for (let key in obj) {
				let keys = [];
				if (parentKey) {
					keys.push(parentKey);
				}
				keys.push(key);
				this._addComputedEntry(computedData, obj[key], keys.join("."), declaredDependencies);
			}
		} else {
			// Numbers, booleans, etc
			computedData.add(parentKey, obj, declaredDependencies);
		}
	}

	async addComputedData(data) {
		let computedData = ResolveConfigurationData.getValue(data, this.config.keys.computed);
		if (isPlainObject(computedData)) {
			this.computedData = new ComputedData(this.config);

			// Note that `permalink` is only a thing that gets consumed—it does not go directly into generated data
			// this allows computed entries to use page.url or page.outputPath and they’ll be resolved properly

			// TODO Room for optimization here—we don’t need to recalculate `getOutputHref` and `getOutputPath`
			// TODO Why are these using addTemplateString instead of add
			this.computedData.addTemplateString(
				"page.url",
				async function (data) {
					return this.tmpl.getOutputHref(data);
				},
				data.permalink ? ["permalink"] : undefined,
				false, // skip symbol resolution
				this,
			);

			this.computedData.addTemplateString(
				"page.outputPath",
				async function (data) {
					return this.tmpl.getOutputPath(data);
				},
				data.permalink ? ["permalink"] : undefined,
				false, // skip symbol resolution
				this,
			);

			// Check for reserved properties in computed data
			let computedData = ResolveConfigurationData.getValue(data, this.config.keys.computed);
			if (this.config.freezeReservedData) {
				ReservedData.checkSubset(computedData);
			}

			// actually add the computed data
			this._addComputedEntry(this.computedData, computedData);

			// limited run of computed data—save the stuff that relies on collections for later.
			debug("First round of computed data for %o", this.inputPath);
			await this.computedData.setupData(data, function (entry) {
				return !this.isUsesStartsWith(entry, "collections.");

				// TODO possible improvement here is to only process page.url, page.outputPath, permalink
				// instead of only punting on things that rely on collections.
				// let firstPhaseComputedData = ["page.url", "page.outputPath", ...this.getOrderFor("page.url"), ...this.getOrderFor("page.outputPath")];
				// return firstPhaseComputedData.indexOf(entry) > -1;
			});
		} else {
			if (!("page" in data)) {
				data.page = {};
			}

			// pagination will already have these set via Pagination->getPageTemplates
			if (data.page.url && data.page.outputPath) {
				return;
			}

			let { href, path } = await this.getOutputLocations(data);
			data.page.url = href;
			data.page.outputPath = path;
		}

		if (this.dataCascade) {
			data.page.mapUrl =
				this.eleventyConfig.directories.getOutputPathRelativeToOutputDirectory(
					data.page.outputPath,
				) + ".map";
		}
	}

	// Computed data consuming collections!
	async resolveRemainingComputedData(data) {
		// If it doesn’t exist, computed data is not used for this template
		if (this.computedData) {
			debug("Second round of computed data for %o", this.inputPath);
			return this.computedData.processRemainingData(data);
		}
	}

	static augmentWithTemplateContentProperty(obj) {
		return Object.defineProperties(obj, {
			needsCheck: {
				enumerable: false,
				writable: true,
				value: true,
			},
			_templateContent: {
				enumerable: false,
				writable: true,
				value: undefined,
			},
			templateContent: {
				enumerable: true,
				set(content) {
					if (content === undefined) {
						this.needsCheck = false;
					}
					this._templateContent = content;
				},
				get() {
					if (this.needsCheck && this._templateContent === undefined) {
						if (this.template.isRenderable()) {
							// should at least warn here
							throw new TemplateContentPrematureUseError(
								`Tried to use templateContent too early on ${this.inputPath}${
									this.pageNumber ? ` (page ${this.pageNumber})` : ""
								}`,
							);
						} else {
							throw new TemplateContentUnrenderedTemplateError(
								`Tried to use templateContent on unrendered template: ${
									this.inputPath
								}${this.pageNumber ? ` (page ${this.pageNumber})` : ""}`,
							);
						}
					}
					return this._templateContent;
				},
			},
			// Alias for templateContent for consistency
			content: {
				enumerable: true,
				get() {
					return this.templateContent;
				},
				set() {
					throw new Error("Setter not available for `content`. Use `templateContent` instead.");
				},
			},
		});
	}

	// via TemplateWriter->createTemplate #4292 #3933
	setPreprocessors(preprocessors) {
		this.#preprocessors = preprocessors;
	}

	async runPreprocessors(data) {
		// @cachedproperty
		if (!this.#preprocessorCache) {
			this.#preprocessorCache = TemplatePreprocessors.runAll(this.#preprocessors, this, data);
		}

		return this.#preprocessorCache;
	}

	async getTemplates(data) {
		let { skippedVia: skippedViaPreprocessorName, content: rawInput } =
			await this.runPreprocessors(data);

		if (skippedViaPreprocessorName) {
			debug(
				"Skipping %o, the %o preprocessor returned an explicit `false`",
				this.inputPath,
				skippedViaPreprocessorName,
			);
			return [];
		}

		// Raw Input *includes* preprocessor modifications
		// https://github.com/11ty/eleventy/issues/1206
		data.page.rawInput = rawInput;

		if (!Pagination.hasPagination(data)) {
			await this.addComputedData(data);

			let obj = {
				template: this, // not on the docs but folks are relying on it
				rawInput,
				groupNumber: 0, // i18n plugin
				data,

				page: data.page,
				inputPath: this.inputPath,
				fileSlug: this.fileSlugStr,
				filePathStem: this.filePathStem,
				date: data.page.date,
				outputPath: data.page.outputPath,
				url: data.page.url,
			};

			obj = Template.augmentWithTemplateContentProperty(obj);

			return [obj];
		} else {
			// needs collections for pagination items
			// but individual pagination entries won’t be part of a collection
			this.paging = new Pagination(this, data, this.config);

			let pageTemplates = await this.paging.getPageTemplates();
			let objects = [];

			for (let pageEntry of pageTemplates) {
				await pageEntry.template.addComputedData(pageEntry.data);

				let obj = {
					template: pageEntry.template, // not on the docs but folks are relying on it
					rawInput,
					pageNumber: pageEntry.pageNumber,
					groupNumber: pageEntry.groupNumber || 0,

					data: pageEntry.data,

					inputPath: this.inputPath,
					fileSlug: this.fileSlugStr,
					filePathStem: this.filePathStem,

					page: pageEntry.data.page,
					date: pageEntry.data.page.date,
					outputPath: pageEntry.data.page.outputPath,
					url: pageEntry.data.page.url,
				};

				obj = Template.augmentWithTemplateContentProperty(obj);

				objects.push(obj);
			}

			return objects;
		}
	}

	async _write({ url, outputPath, data, rawInput }, finalContent) {
		let lang = {
			start: "Writing",
			finished: "written",
		};

		if (!this.isDryRun) {
			if (this.logger.isLoggingEnabled()) {
				let isVirtual = this.isVirtualTemplate();
				let tr = await this.getTemplateRender();
				let engineList = tr.getReadableEnginesListDifferingFromFileExtension();
				let suffix = `${isVirtual ? " (virtual)" : ""}${engineList ? ` (${engineList})` : ""}`;
				this.logger.log(
					`${lang.start} ${outputPath} ${chalk.gray(`from ${this.inputPath}${suffix}`)}`,
				);
			}
		} else if (this.isDryRun) {
			return;
		}

		let templateBenchmarkDir = this.bench.get("Template make parent directory");
		templateBenchmarkDir.before();

		this.fsManager.createDirectoryForFileSync(outputPath);

		templateBenchmarkDir.after();

		if (!Buffer.isBuffer(finalContent) && typeof finalContent !== "string") {
			throw new Error(
				`The return value from the render function for the ${this.engine.name} template was not a String or Buffer. Received ${finalContent}`,
			);
		}

		let templateBenchmark = this.bench.get("Template Write");
		templateBenchmark.before();

		this.fsManager.writeFileSync(outputPath, finalContent);

		templateBenchmark.after();
		this.writeCount++;
		debug(`${outputPath} ${lang.finished}.`);

		let ret = {
			inputPath: this.inputPath,
			outputPath: outputPath,
			url,
			content: finalContent,
			rawInput,
		};

		if (data && this.config.dataFilterSelectors?.size > 0) {
			ret.data = this.retrieveDataForJsonOutput(data, this.config.dataFilterSelectors);
		}

		return ret;
	}

	async #renderPageEntryWithLayoutsAndTransforms(pageEntry) {
		// Don’t run linters/transforms/layouts if we didn’t render (via incremental)!
		if (pageEntry.template.isDryRun && pageEntry.template.isIncremental) {
			return pageEntry.templateContent;
		}

		let content;
		let layoutKey = pageEntry.data[this.config.keys.layout];
		if (this.engine.useLayouts() && layoutKey) {
			let layout = pageEntry.template.getLayout(layoutKey);
			content = await layout.renderLayoutPageEntry(pageEntry);
		} else {
			content = pageEntry.templateContent;
		}

		await this.runLinters(content, pageEntry);

		content = await this.runTransforms(content, pageEntry);
		return content;
	}

	// This could be `static`
	async renderPageEntry(pageEntry) {
		// @cachedproperty
		if (!pageEntry.template.#cacheRenderedTransformsAndLayoutsPromise) {
			pageEntry.template.#cacheRenderedTransformsAndLayoutsPromise =
				pageEntry.template.#renderPageEntryWithLayoutsAndTransforms(pageEntry);
		}

		return pageEntry.template.#cacheRenderedTransformsAndLayoutsPromise;
	}

	retrieveDataForJsonOutput(data, selectors) {
		// if "*" is in the selectors, return all data unfiltered.
		if (selectors.has("*")) {
			return data;
		}

		let filtered = {};
		for (let selector of selectors) {
			let value = lodashGet(data, selector);
			lodashSet(filtered, selector, value);
		}
		return filtered;
	}

	async generateMapEntry(mapEntry, to) {
		let ret = [];

		for (let page of mapEntry._pages) {
			let content;

			// Note that behavior.render is overridden when using json output
			if (page.template.isRenderable()) {
				// this reuses page.templateContent, it doesn’t render it
				content = await page.template.renderPageEntry(page);
			}

			if (to === "json") {
				let obj = {
					url: page.url,
					inputPath: page.inputPath,
					outputPath: page.outputPath,
					rawInput: page.rawInput,
					content,
				};

				if (this.config.dataFilterSelectors?.size > 0) {
					obj.data = this.retrieveDataForJsonOutput(page.data, this.config.dataFilterSelectors);
				}

				// json
				ret.push(obj);
				continue;
			}

			if (!page.template.isRenderable()) {
				debug("Template not written %o from %o.", page.outputPath, page.template.inputPath);
				continue;
			}

			if (!page.template.behavior.isWriteable()) {
				debug(
					"Template not written %o from %o (via permalink: false, permalink.build: false, or a permalink object without a build property).",
					page.outputPath,
					page.template.inputPath,
				);
				continue;
			}

			// compile returned undefined
			if (content !== undefined) {
				ret.push(this._write(page, content));
			}
		}

		return Promise.all(ret);
	}

	async clone() {
		// QUESTION do we need to even run the constructor here or can we simplify it even more
		let tmpl = new Template(
			this.inputPath,
			this.templateData,
			this.extensionMap,
			this.eleventyConfig,
		);

		tmpl.logger = this.logger;

		// preserves caches too, e.g. _frontMatterDataCache
		// Does not yet include .computedData
		for (let key in this) {
			tmpl[key] = this[key];
		}

		return tmpl;
	}

	getWriteCount() {
		return this.writeCount;
	}

	getRenderCount() {
		return this.renderCount;
	}

	getInputFileStat() {
		// @cachedproperty
		if (!this.#stats) {
			this.#stats = statSync(this.inputPath);
		}

		return this.#stats;
	}

	async _getDateInstance(key = "birthtimeMs") {
		let stat = this.getInputFileStat();

		// Issue 1823: https://github.com/11ty/eleventy/issues/1823
		// return current Date in a Lambda
		// otherwise ctime would be "1980-01-01T00:00:00.000Z"
		// otherwise birthtime would be "1970-01-01T00:00:00.000Z"
		if (stat.birthtimeMs === 0) {
			return new Date();
		}

		let newDate = new Date(stat[key]);

		debug(
			"Template date: using file’s %o for %o of %o (from %o)",
			key,
			this.inputPath,
			newDate,
			stat.birthtimeMs,
		);

		return newDate;
	}

	async getMappedDate(dateValue, pageData) {
		// These can return a Date object, or a string.
		// Already type checked to be functions in UserConfig
		for (let fn of this.config.customDateParsing) {
			let ret = fn.call(
				{
					page: pageData,
				},
				dateValue,
			);

			if (ret) {
				debug("getMappedDate: date value override via `addDateParsing` callback to %o", ret);
				dateValue = ret;
			}
		}

		if (dateValue) {
			debug("getMappedDate: using a date in the data for %o of %o", this.inputPath, dateValue);
			if (dateValue?.constructor?.name === "DateTime") {
				// a luxon instance
				debug("getMappedDate: found DateTime instance: %o", dateValue);
				return dateValue.toJSDate();
			}

			if (dateValue instanceof Date) {
				// YAML does its own date parsing
				debug("getMappedDate: found Date instance (maybe from YAML): %o", dateValue);
				return dateValue;
			}

			if (typeof dateValue !== "string") {
				throw new Error(
					`Data cascade value for \`date\` (${dateValue}) is invalid for ${this.inputPath}. Expected a JavaScript Date instance, luxon DateTime instance, or String value.`,
				);
			}

			// special strings
			if (!this.isVirtualTemplate()) {
				if (dateValue.toLowerCase() === "git last modified") {
					let timestamp = await getUpdatedTimestamp(this.inputPath);
					if (timestamp) {
						debug(
							`getMappedDate: found git last modified timestamp for ${this.inputPath}: %o`,
							timestamp,
						);
						return new Date(timestamp);
					}

					// return now if this file is not yet available in `git`
					return new Date();
				}
				if (dateValue.toLowerCase() === "last modified") {
					return this._getDateInstance("ctimeMs");
				}
				if (dateValue.toLowerCase() === "git created") {
					let timestamp = await getCreatedTimestamp(this.inputPath);
					if (timestamp) {
						debug(
							`getMappedDate: found git created timestamp for ${this.inputPath}: %o`,
							timestamp,
						);
						return new Date(timestamp);
					}

					// return now if this file is not yet available in `git`
					return new Date();
				}
				if (dateValue.toLowerCase() === "created") {
					return this._getDateInstance("birthtimeMs");
				}
			}

			// try to parse with Luxon
			return fromISOtoDateUTC(dateValue, this.inputPath);
		}

		// No Date supplied in the Data Cascade, try to find the date in the file name
		let filepathRegex = this.inputPath.match(/(\d{4}-\d{2}-\d{2})/);
		if (filepathRegex !== null) {
			// if multiple are found in the path, use the first one for the date
			let dateObj = fromISOtoDateUTC(filepathRegex[1], this.inputPath);
			debug(
				"getMappedDate: using filename regex time for %o of %o: %o",
				this.inputPath,
				filepathRegex[1],
				dateObj,
			);
			return dateObj;
		}

		// No Date supplied in the Data Cascade
		if (this.isVirtualTemplate()) {
			return new Date();
		}

		return this._getDateInstance("birthtimeMs");
	}

	// Important reminder: Template data is first generated in TemplateMap
	async getTemplateMapEntry(data) {
		this.behavior.setRenderViaDataCascade(data);

		// does not return outputPath or url, we don’t want to render permalinks yet
		return {
			template: this,
			inputPath: this.inputPath,
			data,
		};
	}
}

export default Template;
