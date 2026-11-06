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
import Pagination, { PaginationError } from "./Plugins/Pagination.js";
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
import { trackGlobalDataReads } from "./Data/GlobalDataReads.js";

const { set: lodashSet, get: lodashGet } = lodash;

const debug = createDebug("Template");

// logger => Set of computed data paths already warned about
const earlyReadWarnings = new WeakMap();
// data => layout key whose front matter is merged into that data
const mergedLayoutKeys = new WeakMap();

function assertContentReady(entry, propName) {
	if (entry.needsCheck && entry._templateContent === undefined) {
		let suffix = `${entry.inputPath}${entry.pageNumber ? ` (page ${entry.pageNumber})` : ""}`;
		if (entry.template.isRenderable()) {
			throw new TemplateContentPrematureUseError(`Tried to use ${propName} too early on ${suffix}`);
		}
		throw new TemplateContentUnrenderedTemplateError(
			`Tried to use ${propName} on unrendered template: ${suffix}`,
		);
	}
}

function getContentPipeline(entry) {
	if (!entry.template.hasTemplateRender()) {
		return {};
	}

	let names = entry.template.templateRender.getPipelineStepNames();
	// The first step receives the template source
	return Object.fromEntries(
		names.map((name, j) => [name, j === 0 ? entry.rawInput : entry._stepInputs?.[j - 1]]),
	);
}

// Copy of an entry with a placeholder for `content` that isn’t rendered yet (instead of throwing), Issue #3744
function getSerializableEntry(entry) {
	let copy = {};
	for (let key of Object.keys(entry)) {
		if (key === "content" && entry.needsCheck && entry._templateContent === undefined) {
			copy[key] = "[Internals: content queued to be rendered later]";
		} else {
			copy[key] = entry[key];
		}
	}
	return copy;
}

// Shared across page entries so the accessor functions aren’t recreated per page
const TEMPLATE_CONTENT_PROPERTIES = {
	toJSON: {
		enumerable: false,
		value() {
			return getSerializableEntry(this);
		},
	},
	[Symbol.for("nodejs.util.inspect.custom")]: {
		enumerable: false,
		value() {
			return getSerializableEntry(this);
		},
	},
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
		enumerable: false,
		set(content) {
			if (content === undefined) {
				this.needsCheck = false;
			}
			this._templateContent = content;
		},
		get() {
			assertContentReady(this, "templateContent");
			return this._templateContent;
		},
	},
	_stepInputs: {
		enumerable: false,
		writable: true,
		value: undefined,
	},
	_contentPipeline: {
		enumerable: false,
		writable: true,
		value: undefined,
	},
	// Content each template syntax step received, keyed by engine name, e.g. `contentPipeline.md`
	contentPipeline: {
		enumerable: false,
		set(content) {
			this._contentPipeline = content;
		},
		get() {
			assertContentReady(this, "contentPipeline");
			this._contentPipeline ??= getContentPipeline(this);
			return this._contentPipeline;
		},
	},
	// Live from `page`, computed data can resolve them after collections are built, Issue #1469
	url: {
		enumerable: true,
		configurable: true,
		get() {
			return this.page.url;
		},
		set(value) {
			Object.defineProperty(this, "url", {
				value,
				writable: true,
				enumerable: true,
				configurable: true,
			});
		},
	},
	outputPath: {
		enumerable: true,
		configurable: true,
		get() {
			return this.page.outputPath;
		},
		set(value) {
			Object.defineProperty(this, "outputPath", {
				value,
				writable: true,
				enumerable: true,
				configurable: true,
			});
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
};

class Template extends TemplateContent {
	#logger;
	#fsManager;
	#stats;
	#dataCache;

	#cacheRenderedPromise;
	#cacheRenderedTransformsAndLayoutsPromise;
	#preprocessors;
	#preprocessorCache;

	static #isCloning = false;

	constructor(templatePath, templateData, extensionMap, config) {
		super(templatePath, config);

		// `clone()` copies the remaining fields from the source template
		if (Template.#isCloning) {
			this.extensionMap = extensionMap;
			return;
		}

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

		this.outputFormat = "fs";

		this.behavior = new TemplateBehavior(this.config);
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
		let permalink = TemplatePermalink.resolveBuildAlias(
			ResolveConfigurationData.getValue(data, this.config.keys.permalink) ??
				ResolveConfigurationData.getValue(computedData, this.config.keys.permalink),
		);
		let permalinkValue;
		let isDynamicPermalinkEnabled =
			this.config.dynamicPermalinks && data.dynamicPermalink !== false;

		// `permalink: false` means render but no file system write, e.g. use in collections only)
		// `permalink: true` throws an error
		if (typeof permalink === "boolean") {
			permalinkValue = permalink;
		} else if (isPlainObject(permalink)) {
			// Empty permalink {} object should act as if no permalink was set at all
			if (Object.keys(permalink).length > 0) {
				throw new Error(
					`Permalink objects are not supported (other than \`permalink.build\`). Use a string or \`false\` instead in ${this.inputPath}.`,
				);
			}
		} else if (permalink && !isDynamicPermalinkEnabled) {
			// Issue #838
			permalinkValue = permalink;
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

	usePermalinkRoot(data) {
		return Boolean(data?.[this.config.keys.permalinkRoot]);
	}

	async getOutputLocations(data) {
		this.bench.get("(count) getOutputLocations").incrementCount();
		let link = await this._getLink(data);

		let path;
		if (this.usePermalinkRoot(data)) {
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
		if (this.usePermalinkRoot(data)) {
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

	async #getCascadeSources() {
		let localData = {};
		let globalData = {};

		if (this.templateData) {
			localData = await this.templateData.getTemplateDirectoryData(this.inputPath);
			globalData = await this.templateData.getGlobalData();
		}

		let { data: frontMatterData } = await this.getFrontMatterData();

		let key = this.config.keys.layout;
		let layoutKey = frontMatterData[key] || localData[key] || globalData[key];

		return { localData, globalData, frontMatterData, layoutKey };
	}

	async #getLayoutData(layoutKey) {
		if (!layoutKey) {
			return {};
		}
		return this.getLayout(layoutKey).getData();
	}

	async #getData() {
		let { localData, globalData, frontMatterData, layoutKey } = await this.#getCascadeSources();

		let mergedLayoutData = {};
		let tr = await this.getTemplateRender();
		if (tr.engine.useLayouts()) {
			// Layout front matter data
			mergedLayoutData = await this.#getLayoutData(layoutKey);
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

	// For incremental builds, a global data file change only affects the templates that read it
	trackGlobalDataReads(data) {
		let filesByKey = this.templateData?.getGlobalDataFilesByKey();
		if (!filesByKey?.size) {
			return;
		}

		trackGlobalDataReads(data, filesByKey, (files) => {
			this.config.uses.addDataFiles(this.inputPath, files);
		});
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
			relativeInputPath: this.eleventyConfig.directories.getInputPathRelativeToInputDirectory(
				this.inputPath,
			),
			outputFileExtension: this.engine.defaultTemplateFileExtension,
			templateSyntax: this.templateRender.getEnginesList(this.getEngineOverride(data)),
		};

		// A computed `date` is mapped (once) with the rest of computed data
		let computedData = ResolveConfigurationData.getValue(data, this.config.keys.computed);
		if (!isPlainObject(computedData) || !("date" in computedData)) {
			let newDate = await this.getMappedDate(data?.date, page);
			// Skip date assignment if custom date is falsy.
			if (newDate) {
				page.date = newDate;
			}
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

	async renderDirect(str, data, templateOnly, renderContext) {
		return super.render(str, data, templateOnly, renderContext);
	}

	// see also Eleventy->#resetFileInWatchQueue()
	internalTriggerTemplateModifiedPath(changedFilePath) {
		this.config.events.emit("buildawesome#templatemodified", changedFilePath);
	}

	// This is the primary render mechanism, called via TemplateMap->populateContentDataInMap
	async renderPageEntryWithoutLayout(pageEntry) {
		// @cachedproperty
		if (!this.#cacheRenderedPromise) {
			let renderContext = { stepInputs: [] };
			this.#cacheRenderedPromise = this.renderDirect(
				pageEntry.rawInput,
				pageEntry.data,
				false,
				renderContext,
			).then((content) => {
				pageEntry._stepInputs =
					renderContext.stepInputs.length > 0 ? renderContext.stepInputs : undefined;
				pageEntry._contentPipeline = undefined;
				return content;
			});
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

		if (typeof entry === "function") {
			return entry(data);
		}

		// Returns new objects/arrays, the source is shared across pages
		if (Array.isArray(entry)) {
			return Promise.all(entry.map((child) => this.#renderComputedUnit(child, data)));
		}

		if (isPlainObject(entry)) {
			let rendered = {};
			for (let key in entry) {
				rendered[key] = await this.#renderComputedUnit(entry[key], data);
			}
			return rendered;
		}

		return entry;
	}

	_addComputedEntry(computedData, obj, parentKey, declaredDependencies) {
		// this check must come before isPlainObject
		if (typeof obj === "function") {
			computedData.add(parentKey, obj, declaredDependencies);
		} else if (Array.isArray(obj) || typeof obj === "string") {
			// Arrays are treated as one entry in the dependency graph, Issue #3728
			computedData.addTemplateString(
				parentKey,
				async function (innerData) {
					return this.tmpl.#renderComputedUnit(obj, innerData);
				},
				declaredDependencies,
				async (innerData) => this.parseForSymbols(obj, await this.getComputedDataEngine(innerData)),
				this,
			);
		} else if (isPlainObject(obj)) {
			for (let key in obj) {
				let childKey = parentKey ? `${parentKey}.${key}` : key;
				this._addComputedEntry(computedData, obj[key], childKey, declaredDependencies);
			}
		} else {
			// Numbers, booleans, etc
			computedData.add(parentKey, obj, declaredDependencies);
		}
	}

	#createComputedData(data) {
		let computedData = ResolveConfigurationData.getValue(data, this.config.keys.computed);
		if (!isPlainObject(computedData)) {
			return;
		}

		let cd = new ComputedData(this.config, {
			// e.g. ./articles/first.md › populatedCategories › collections
			onEarlyRead: (path) => this.#warnEarlyRead(path),
		});

		// `permalink` is consumed (not added to data) so computed entries can use page.url/page.outputPath
		// One permalink render per data object, shared by `page.url` and `page.outputPath`
		let outputLocations = new WeakMap();
		let getOutputLocations = (data) => {
			if (!outputLocations.has(data)) {
				outputLocations.set(data, this.getOutputLocations(data));
			}
			return outputLocations.get(data);
		};

		// Template string so placeholder rendering detects a computed `permalink` dependency
		cd.addTemplateString("page.url", async (data) => (await getOutputLocations(data)).href, [
			"permalink",
			"dynamicPermalink",
			this.config.keys.permalinkRoot,
		]);
		// Same dependencies as `page.url` (no symbols to parse), so it resolves right after with the same render
		cd.addTemplateString(
			"page.outputPath",
			async (data) => (await getOutputLocations(data)).path,
			["page.url"],
			() => [],
		);

		// Computed `date` maps to `page.date`, Issue #4415
		if ("date" in computedData) {
			// Raw page data (not the tracking proxy) so date parsing callbacks see the same object as without computed data
			let pageData = data.page;
			cd.add("page.date", async (computed) => this.getMappedDate(computed.date, pageData), [
				"date",
			]);
		}

		if (this.config.freezeReservedData) {
			ReservedData.checkSubset(computedData);
		}

		this._addComputedEntry(cd, computedData);

		return cd;
	}

	// One warning per path (not per page), per logger (Eleventy instance)
	#warnOnce(id, message) {
		if (!earlyReadWarnings.has(this.logger)) {
			earlyReadWarnings.set(this.logger, new Set());
		}
		let warned = earlyReadWarnings.get(this.logger);
		if (warned.has(id)) {
			return;
		}
		warned.add(id);
		this.logger.warn(message);
	}

	// e.g. ./articles/first.md › populatedCategories › collections (deferred) or ./index.md › title (not yet run)
	#warnEarlyRead(path) {
		let prefix = `Warning: computed data was read before it resolved, so the read got its previous value (often \`undefined\`): ${[this.inputPath, ...path].join(" › ")}.`;
		if (path.length === 1) {
			this.#warnOnce(
				path.join(" › "),
				`${prefix} Computed data resolves after preprocessors (except \`date\`, \`layout\`, ${this.config.keys.tags ? `\`${this.config.keys.tags}\`, ` : ""}\`${ResolveConfigurationData.EXCLUDE_FROM_COLLECTIONS_KEY}\`, \`${this.config.keys.import}\`, and paginated data), so read this value at render time instead.`,
			);
			return;
		}

		this.#warnOnce(
			path.join(" › "),
			`${prefix} This is likely a read from another page. You can work around this issue by reading the value at render time, or by reading \`collections\` directly in the computed data that reads this value (e.g. \`data.${path.at(-1)}\` instead of \`….data.${path[0]}\`).`,
		);
	}

	// Stage 1: before preprocessors and pagination, resolves computed data that doesn’t need either.
	async #setupComputedData(data) {
		this.computedData = this.#createComputedData(data);
		if (!this.computedData) {
			return;
		}

		await this.#setupComputedPagination(data);

		let unavailable = ["page.rawInput", ...this.#getUnavailableBeforePagination(data)];

		await this.#setupComputedLayout(data, unavailable, (await this.#getCascadeSources()).layoutKey);

		// Other computed data stays lazy (and guarded against early reads) until stage 2
		debug("First round of computed data for %o", this.inputPath);
		await this.computedData.setupData(data, {
			unavailable,
			keys: this.#getEarlyComputedKeys(data),
		});
	}

	#getUnavailableBeforePagination(data) {
		let unavailable = ["collections"];
		if (Pagination.hasPagination(data)) {
			unavailable.push("pagination", "page.url", "page.outputPath");
			if (data.pagination?.alias) {
				unavailable.push(data.pagination.alias);
			}
		}
		return unavailable;
	}

	// Computed keys consumed before stage 2 (preprocessors, pagination, the collections dependency graph), Issue #4415
	#getEarlyComputedKeys(data) {
		let early = [
			"page.date",
			...(this.config.keys.tags ? [this.config.keys.tags] : []),
			...ResolveConfigurationData.getEligibleLocations(this.config.keys.import),
			...ResolveConfigurationData.getEligibleLocations(
				ResolveConfigurationData.EXCLUDE_FROM_COLLECTIONS_KEY,
			),
		];
		if (typeof data.pagination?.data === "string") {
			early.push(data.pagination.data);
		}
		return Array.from(this.computedData.computedKeys).filter((key) =>
			early.some(
				(name) => key === name || key.startsWith(name + ".") || name.startsWith(key + "."),
			),
		);
	}

	// Computed `layout` resolves before other computed data so they see its front matter, Issues #2236 #1528
	async #setupComputedLayout(data, unavailable, mergedLayoutKey) {
		let key = this.config.keys.layout;
		if (!this.computedData.computedKeys.has(key) || !this.engine.useLayouts()) {
			return;
		}

		await this.computedData.setupData(data, { unavailable, keys: [key] });
		if (this.computedData.getDeferred(key, data)) {
			return;
		}

		let layoutKey = data[key];
		if (layoutKey !== mergedLayoutKey) {
			let { localData, globalData, frontMatterData } = await this.#getCascadeSources();
			let previousLayoutData = await this.#getLayoutData(mergedLayoutKey);
			let layoutData = await this.#getLayoutData(layoutKey);
			let merged = Merge({}, globalData, layoutData, localData, frontMatterData);
			let computedKeys = this.computedData.computedKeys;

			for (let name of new Set([...Object.keys(previousLayoutData), ...Object.keys(layoutData)])) {
				if (!computedKeys.has(name)) {
					data[name] = merged[name];
				}
			}
		}

		mergedLayoutKeys.set(data, layoutKey);
	}

	// Computed `pagination` resolves first, it decides which data is per page, Issue #4415
	async #setupComputedPagination(data) {
		let keys = Array.from(this.computedData.computedKeys).filter(
			(key) => key === "pagination" || key.startsWith("pagination."),
		);
		if (keys.length === 0) {
			return;
		}

		await this.computedData.setupData(data, {
			unavailable: ["page.rawInput", "collections", "page.url", "page.outputPath"],
			keys,
		});

		for (let key of keys) {
			let deferred = this.computedData.getDeferred(key, data);
			if (deferred) {
				throw new PaginationError(
					`Computed \`${key}\` (${this.inputPath}) reads \`${deferred.reason}\`, which isn’t available until after pagination.`,
				);
			}
		}
	}

	// Pagination data from computed data must resolve before pagination (stage 1), Issue #4415
	#checkComputedPaginationData(data) {
		let key = data.pagination?.data;
		let deferred = typeof key === "string" && this.computedData?.getDeferred(key, data);
		if (deferred) {
			throw new PaginationError(
				`Pagination data \`${key}\` can’t use computed data \`${deferred.key}\` (${this.inputPath}) because it reads \`${deferred.reason}\`, which isn’t available until after pagination.`,
			);
		}
	}

	// Stage 2: per page (after pagination), `parent` is the paginated template’s computed data.
	async addComputedData(data, parent) {
		if (parent?.computedData) {
			this.computedData = this.#createComputedData(data);
			this.computedData.inherit(data, parent.computedData, parent.data);
		}

		if (this.computedData) {
			let mergedLayoutKey = mergedLayoutKeys.has(data)
				? mergedLayoutKeys.get(data)
				: mergedLayoutKeys.has(parent?.data)
					? mergedLayoutKeys.get(parent.data)
					: (await this.#getCascadeSources()).layoutKey;
			await this.#setupComputedLayout(data, ["collections"], mergedLayoutKey);

			// Collections aren’t built yet, see resolveRemainingComputedData
			debug("Second round of computed data for %o", this.inputPath);
			await this.computedData.setupData(data, { unavailable: ["collections"] });
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
			debug("Last round of computed data for %o", this.inputPath);
			await this.computedData.processRemainingData(data);
			await this.#warnComputedLayoutData(data);
		}
	}

	// A computed `layout` that reads `collections` resolves after other computed data, so its front matter is skipped, Issue #2236
	async #warnComputedLayoutData(data) {
		let key = this.config.keys.layout;
		let layoutKey = data[key];
		if (
			!this.computedData.computedKeys.has(key) ||
			!layoutKey ||
			layoutKey === mergedLayoutKeys.get(data) ||
			!this.engine.useLayouts()
		) {
			return;
		}

		let layoutData = await this.getLayout(layoutKey).getData();
		if (Object.keys(layoutData).length === 0) {
			return;
		}

		this.#warnOnce(
			`${key} › ${layoutKey}`,
			`Warning: computed data set \`${key}\` to \`${layoutKey}\` after the rest of computed data resolved (likely because it reads \`collections\`), so that layout’s front matter data was not applied: ${this.inputPath} › ${key}. You can work around this issue by computing \`${key}\` without reading \`collections\`, or by setting it outside of computed data (e.g. front matter or a directory data file).`,
		);
	}

	static augmentWithTemplateContentProperty(obj) {
		// Hidden from enumeration to make collection entries easier to serialize, Issue #3744
		Object.defineProperty(obj, "template", { enumerable: false });
		return Object.defineProperties(obj, TEMPLATE_CONTENT_PROPERTIES);
	}

	// via TemplateWriter->createTemplate #4292 #3933
	setPreprocessors(preprocessors) {
		this.#preprocessors = preprocessors;
	}

	async runPreprocessors(data) {
		// @cachedproperty
		if (!this.#preprocessorCache) {
			this.#preprocessorCache = this.#setupComputedData(data).then(() =>
				TemplatePreprocessors.runAll(this.#preprocessors, this, data),
			);
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
			};

			obj = Template.augmentWithTemplateContentProperty(obj);

			return [obj];
		} else {
			this.#checkComputedPaginationData(data);

			// Resolved once on the paginated template (not per page) when it doesn’t read per-page data
			if (this.computedData) {
				await this.computedData.setupData(data, {
					unavailable: this.#getUnavailableBeforePagination(data),
				});
			}

			// needs collections for pagination items
			// but individual pagination entries won’t be part of a collection
			this.paging = new Pagination(this, data, this.config);

			let pageTemplates = await this.paging.getPageTemplates();
			let objects = [];

			for (let pageEntry of pageTemplates) {
				await pageEntry.template.addComputedData(pageEntry.data, {
					computedData: this.computedData,
					data,
				});

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

		// Output hashes are only tracked in watch/serve (set by Core).
		let outputHashes = this.eleventyConfig.isWatchOrServe()
			? this.eleventyConfig.outputHashes
			: undefined;
		let changed = outputHashes ? outputHashes.update(outputPath, finalContent) : true;

		let skipWrite =
			!changed &&
			this.config.skipUnchangedWrites &&
			this.eleventyConfig.existsCache.exists(outputPath);

		if (!skipWrite) {
			let templateBenchmark = this.bench.get("Template Write");
			templateBenchmark.before();

			this.fsManager.writeFileSync(outputPath, finalContent);

			templateBenchmark.after();
		}
		this.writeCount++;
		debug(`${outputPath} ${lang.finished}.`);

		let ret = {
			inputPath: this.inputPath,
			outputPath: outputPath,
			url,
			content: finalContent,
			rawInput,
		};

		if (outputHashes) {
			ret.changed = changed;
		}

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
			// Skip layouts and transforms for pages that won’t be written (JSON output reports content for every page).
			if (to !== "json") {
				if (!page.template.isRenderable()) {
					debug("Template not written %o from %o.", page.outputPath, page.template.inputPath);
					continue;
				}

				// Per page, since paginated clones share one `behavior` (permalink can vary by page), Issue #2806
				if (page.outputPath === false) {
					debug(
						"Template not written %o from %o (via permalink: false).",
						page.outputPath,
						page.template.inputPath,
					);
					continue;
				}
			}

			let content;
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

			// compile returned undefined
			if (content !== undefined) {
				ret.push(this._write(page, content));
			}
		}

		return Promise.all(ret);
	}

	async clone() {
		let tmpl;
		Template.#isCloning = true;
		try {
			tmpl = new Template(
				this.inputPath,
				this.templateData,
				this.extensionMap,
				this.eleventyConfig,
			);
		} finally {
			Template.#isCloning = false;
		}

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
			return fromISOtoDateUTC(dateValue, this.inputPath, this.config.dateTimeZone);
		}

		// No Date supplied in the Data Cascade, try to find the date in the file name
		let filepathRegex = this.inputPath.match(/(\d{4}-\d{2}-\d{2})/);
		if (filepathRegex !== null) {
			// if multiple are found in the path, use the first one for the date
			let dateObj = fromISOtoDateUTC(filepathRegex[1], this.inputPath, this.config.dateTimeZone);
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
		// does not return outputPath or url, we don’t want to render permalinks yet
		return {
			template: this,
			inputPath: this.inputPath,
			data,
		};
	}
}

export default Template;
