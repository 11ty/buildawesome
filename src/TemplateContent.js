import { readFileSync } from "node:fs";
import matter from "@11ty/gray-matter";
import lodash from "@11ty/lodash-custom";
import { DeepCopy, TemplatePath } from "@11ty/eleventy-utils";

import JavaScriptFrontMatter from "./Engines/FrontMatter/JavaScript.js";
import { createDebug } from "./Util/DebugLogUtil.js";
import { EOL } from "./Util/NewLineAdapter.js";
import TemplateData from "./Data/TemplateData.js";
import TemplateRender from "./TemplateRender.js";
import BaseError from "./Errors/BaseError.js";
import ErrorUtil from "./Errors/ErrorUtil.js";
import eventBus from "./EventBus.js";

const { set: lodashSet } = lodash;
const debug = createDebug("TemplateContent");

class TemplateContentFrontMatterError extends BaseError {}
class TemplateContentCompileError extends BaseError {}
class TemplateContentRenderError extends BaseError {}

class TemplateContent {
	#initialized = false;
	#config;
	#templateRender;
	#renderPreprocessorEngine;
	#extensionMap;
	#configOptions;
	#frontMatterOptions;

	constructor(inputPath, templateConfig) {
		if (!templateConfig || templateConfig.constructor.name !== "TemplateConfig") {
			throw new Error("Missing or invalid `templateConfig` argument");
		}
		this.eleventyConfig = templateConfig;
		this.inputPath = inputPath;
	}

	async asyncTemplateInitialization() {
		if (!this.hasTemplateRender()) {
			await this.getTemplateRender();
		}

		if (this.#initialized) {
			return;
		}
		this.#initialized = true;

		let preprocessorEngineName = this.templateRender.getPreprocessorEngineName();
		if (preprocessorEngineName && this.templateRender.engine.getName() !== preprocessorEngineName) {
			let engine = await this.templateRender.getEngineByName(preprocessorEngineName);
			this.#renderPreprocessorEngine = engine;
		}
	}

	resetCachedTemplate({ eleventyConfig }) {
		this.eleventyConfig = eleventyConfig;
	}

	get dirs() {
		return this.eleventyConfig.directories;
	}

	get inputDir() {
		return this.dirs.input;
	}

	get outputDir() {
		return this.dirs.output;
	}

	getResetTypes(types) {
		if (types) {
			return Object.assign(
				{
					data: false,
					read: false,
					render: false,
				},
				types,
			);
		}

		return {
			data: true,
			read: true,
			render: true,
		};
	}

	// Called during an incremental build when the template instance is cached but needs to be reset because it has changed
	resetCaches(types) {
		types = this.getResetTypes(types);

		if (types.read) {
			delete this.readingPromise;
			delete this.inputContent;
			delete this._frontMatterDataCache;
		}
		if (types.render) {
			this.#templateRender = undefined;
		}
	}

	get extensionMap() {
		if (!this.#extensionMap) {
			throw new Error("Internal error: Missing `extensionMap` in TemplateContent.");
		}
		return this.#extensionMap;
	}

	set extensionMap(map) {
		this.#extensionMap = map;
	}

	set eleventyConfig(config) {
		this.#config = config;

		if (this.#config.constructor.name === "TemplateConfig") {
			this.#configOptions = this.#config.getConfig();
		} else {
			throw new Error("Tried to get an TemplateConfig but none was found.");
		}
	}

	get eleventyConfig() {
		if (this.#config.constructor.name === "TemplateConfig") {
			return this.#config;
		}
		throw new Error("Tried to get an TemplateConfig but none was found.");
	}

	get config() {
		if (this.#config.constructor.name === "TemplateConfig" && !this.#configOptions) {
			this.#configOptions = this.#config.getConfig();
		}

		return this.#configOptions;
	}

	get bench() {
		return this.config.benchmarkManager.get("Aggregate");
	}

	get engine() {
		return this.templateRender.engine;
	}

	get templateRender() {
		if (!this.hasTemplateRender()) {
			throw new Error(`\`templateRender\` has not yet initialized on ${this.inputPath}`);
		}

		return this.#templateRender;
	}

	hasTemplateRender() {
		return !!this.#templateRender;
	}

	async getTemplateRender() {
		if (!this.#templateRender) {
			this.#templateRender = new TemplateRender(this.inputPath, this.eleventyConfig);
			this.#templateRender.extensionMap = this.extensionMap;

			return this.#templateRender.init().then(() => {
				return this.#templateRender;
			});
		}

		return this.#templateRender;
	}

	// For monkey patchers
	get frontMatter() {
		if (this.frontMatterOverride) {
			return this.frontMatterOverride;
		} else {
			throw new Error(
				"Unfortunately you’re using code that monkey patched some Eleventy internals and it isn’t async-friendly. Change your code to use the async `read()` method on the template instead!",
			);
		}
	}

	// For monkey patchers
	set frontMatter(contentOverride) {
		this.frontMatterOverride = contentOverride;
	}

	getInputPath() {
		return this.inputPath;
	}

	getInputDir() {
		return this.inputDir;
	}

	isVirtualTemplate() {
		let def = this.getVirtualTemplateDefinition();
		return !!def;
	}

	getVirtualTemplateDefinition() {
		let inputDirRelativeInputPath =
			this.eleventyConfig.directories.getInputPathRelativeToInputDirectory(this.inputPath);
		return this.config.virtualTemplates[inputDirRelativeInputPath];
	}

	getFrontMatterParsingOptions() {
		if (!this.#frontMatterOptions) {
			this.#frontMatterOptions = DeepCopy(
				{
					// Set a project-wide default.
					// language: "yaml",

					// Supplementary engines
					engines: {
						// v4: Moved to a fork of gray-matter to modernize to js-yaml@4 internally
						// v4.0.0-alpha.11 gray-matter@3 upgrade removed timestamp/date from YAML parsing (workaround available at #4333)
						// yaml: yaml.load.bind(yaml),

						// Backwards compatible with `js` object front matter
						// https://github.com/11ty/eleventy/issues/2819
						javascript: JavaScriptFrontMatter,

						// Upstream `js` was removed in @11ty/gray-matter@2
						js: JavaScriptFrontMatter,

						node: function () {
							throw new Error(
								"The `node` front matter type was a 3.0.0-alpha.x only feature, removed for stable release. Rename to `js` or `javascript` instead!",
							);
						},
					},
				},
				this.config.frontMatterParsingOptions,
			);
		}

		return this.#frontMatterOptions;
	}

	async #read() {
		let content = await this.inputContent;

		if (content || content === "") {
			let tr = await this.getTemplateRender();
			if (tr.engine.useJavaScriptImport()) {
				return {
					data: {},
					content,
				};
			}

			let options = this.getFrontMatterParsingOptions();
			let fm;
			try {
				// Added in 3.0, passed along to front matter engines
				options.filePath = this.inputPath;
				fm = matter(content, options);
			} catch (e) {
				throw new TemplateContentFrontMatterError(
					`Having trouble reading front matter from template ${this.inputPath}`,
					e,
				);
			}

			if (typeof fm.data?.then === "function") {
				fm.data = await fm.data;
			}

			if (options.excerpt && fm.excerpt) {
				let excerptString = fm.excerpt + (options.excerpt_separator || "---");
				if (fm.content.startsWith(excerptString + EOL)) {
					// with an os-specific newline after excerpt separator
					fm.content = fm.excerpt.trim() + "\n" + fm.content.slice((excerptString + EOL).length);
				} else if (fm.content.startsWith(excerptString + "\n")) {
					// with a newline (\n) after excerpt separator
					// This is necessary for some git configurations on windows
					fm.content = fm.excerpt.trim() + "\n" + fm.content.slice((excerptString + 1).length);
				} else if (fm.content.startsWith(excerptString)) {
					// no newline after excerpt separator
					fm.content = fm.excerpt + fm.content.slice(excerptString.length);
				}

				// alias, defaults to page.excerpt
				let alias = options.excerpt_alias || "page.excerpt";
				lodashSet(fm.data, alias, fm.excerpt);
			}

			// For monkey patchers that used `frontMatter` 🤧
			// https://github.com/11ty/eleventy/issues/613#issuecomment-999637109
			// https://github.com/11ty/eleventy/issues/2710#issuecomment-1373854834
			// Removed this._frontMatter monkey patcher help in 3.0.0-alpha.7

			return fm;
		} else {
			return {
				data: {},
				content: "",
				excerpt: "",
			};
		}
	}

	async read() {
		if (!this.readingPromise) {
			if (!this.inputContent) {
				// @cachedproperty
				this.inputContent = this.getInputContent();
			}

			// @cachedproperty
			this.readingPromise = this.#read();
		}

		return this.readingPromise;
	}

	/* Incremental builds cache the Template instances (in TemplateWriter) but
	 * these template specific caches are important for Pagination */
	static cache(path, content) {
		this._inputCache.set(TemplatePath.absolutePath(path), content);
	}

	static getCached(path) {
		return this._inputCache.get(TemplatePath.absolutePath(path));
	}

	static deleteFromInputCache(path) {
		this._inputCache.delete(TemplatePath.absolutePath(path));
	}

	// Used via clone
	setInputContent(content) {
		this.inputContent = content;
	}

	async getInputContent() {
		let tr = await this.getTemplateRender();

		let virtualTemplateDefinition = this.getVirtualTemplateDefinition();
		if (virtualTemplateDefinition) {
			let { content } = virtualTemplateDefinition;
			return content;
		}

		if (
			tr.engine.useJavaScriptImport() &&
			typeof tr.engine.getInstanceFromInputPath === "function"
		) {
			return tr.engine.getInstanceFromInputPath(this.inputPath);
		}

		if (!tr.engine.needsToReadFileContents()) {
			return "";
		}

		let templateBenchmark = this.bench.get("Template Read");
		templateBenchmark.before();

		let content;

		if (this.config.useTemplateCache) {
			content = TemplateContent.getCached(this.inputPath);
		}

		if (!content && content !== "") {
			let contentBuffer = readFileSync(this.inputPath);

			content = contentBuffer.toString("utf8");

			if (this.config.useTemplateCache) {
				TemplateContent.cache(this.inputPath, content);
			}
		}

		templateBenchmark.after();

		return content;
	}

	async _testGetFrontMatter() {
		let fm = this.frontMatterOverride ? this.frontMatterOverride : await this.read();

		return fm;
	}

	async getPreRender() {
		let fm = this.frontMatterOverride ? this.frontMatterOverride : await this.read();

		return fm.content;
	}

	async #getFrontMatterData() {
		let fm = await this.read();

		let virtualTemplateDefinition = this.getVirtualTemplateDefinition();
		let virtualTemplateData;
		if (virtualTemplateDefinition) {
			virtualTemplateData = virtualTemplateDefinition.data;

			TemplateData.cleanupData(virtualTemplateData, {
				file: this.inputPath,
				isVirtualTemplate: Boolean(virtualTemplateData),
			});
		}

		// gray-matter isn’t async-friendly but can return a promise from custom front matter
		if (fm.data instanceof Promise) {
			fm.data = await fm.data;
		}

		let frontMatterData = Object.assign({}, fm.data);

		TemplateData.cleanupData(frontMatterData, {
			file: this.inputPath,
			isVirtualTemplate: Boolean(virtualTemplateData),
		});

		let tr = await this.getTemplateRender();
		let extraData = await tr.engine.getExtraDataFromFile(this.inputPath);

		TemplateData.cleanupData(extraData, {
			file: this.inputPath,
			isVirtualTemplate: Boolean(virtualTemplateData),
		});

		let data = Object.assign(frontMatterData, extraData, virtualTemplateData);

		return {
			data,
			excerpt: fm.excerpt,
		};
	}

	async getFrontMatterData() {
		if (!this._frontMatterDataCache) {
			// @cachedproperty
			this._frontMatterDataCache = this.#getFrontMatterData();
		}

		return this._frontMatterDataCache;
	}

	getEngineNames(engineOverride) {
		return this.templateRender.getEnginesList(engineOverride);
	}

	async getEngineOverride() {
		return this.getFrontMatterData().then((data) => {
			return data[this.config.keys.engineOverride];
		});
	}

	// checks engines
	isTemplateCacheable() {
		if (this.#renderPreprocessorEngine) {
			return this.#renderPreprocessorEngine.cacheable;
		}
		return this.engine.cacheable;
	}

	_getCompileCache(str) {
		// Caches used to be bifurcated based on engine name, now they’re based on inputPath
		// TODO does `cacheable` need to help inform whether a cache is used here?
		let inputPathMap = TemplateContent._compileCache.get(this.inputPath);
		if (!inputPathMap) {
			inputPathMap = new Map();
			TemplateContent._compileCache.set(this.inputPath, inputPathMap);
		}

		let cacheable = this.isTemplateCacheable();
		let { useCache, key } = this.engine.getCompileCacheKey(str, this.inputPath);

		// We also tie the compile cache key to the UserConfig instance, to alleviate issues with global template cache
		// Better to move the cache to the Eleventy instance instead, no?
		// (This specifically failed I18nPluginTest cases with filters being cached across tests and not having access to each plugin’s options)
		key = this.eleventyConfig.userConfig._getUniqueId() + key;

		return [cacheable, key, inputPathMap, useCache];
	}

	async compile(str, options = {}) {
		let { type, bypassMarkdown, engineOverride } = options;

		// Must happen before cacheable fetch below
		// Likely only necessary for Eleventy Layouts, see TemplateMap->initDependencyMap
		await this.asyncTemplateInitialization();

		// this.templateRender is guaranteed here
		let tr = await this.getTemplateRender();
		if (engineOverride !== undefined) {
			await tr.setEngineOverride(engineOverride, bypassMarkdown);
		} else {
			tr.setUseMarkdown(!bypassMarkdown);
		}
		if (bypassMarkdown && !this.engine.needsCompilation(str)) {
			return function () {
				return str;
			};
		}

		try {
			let res;
			if (this.config.useTemplateCache) {
				let [cacheable, key, cache, useCache] = this._getCompileCache(str);
				if (cacheable && key) {
					if (useCache && cache.has(key)) {
						this.bench.get("(count) Template Compile Cache Hit").incrementCount();
						return cache.get(key);
					}

					this.bench.get("(count) Template Compile Cache Miss").incrementCount();

					// Compile cache is cleared when the resource is modified (below)

					// Compilation is async, so we eagerly cache a Promise that eventually
					// resolves to the compiled function
					let withRes = Promise.withResolvers();
					res = withRes.resolve;

					cache.set(key, withRes.promise);
				}
			}

			let typeStr = type ? ` ${type}` : "";
			let templateBenchmark = this.bench.get(`Template Compile${typeStr}`);
			let inputPathBenchmark = this.bench.get(`> Compile${typeStr} > ${this.inputPath}`);
			templateBenchmark.before();
			inputPathBenchmark.before();

			let fn = await tr.getCompiledTemplate(str);
			inputPathBenchmark.after();
			templateBenchmark.after();

			if (this.config.useTemplateCache && res) {
				res(fn);
			}
			return fn;
		} catch (e) {
			let [cacheable, key, cache] = this._getCompileCache(str);
			if (cacheable && key) {
				cache.delete(key);
			}
			debug(`Having trouble compiling template ${this.inputPath}: %O`, str);
			throw new TemplateContentCompileError(
				`Having trouble compiling template ${this.inputPath}`,
				e,
			);
		}
	}

	getParseForSymbolsFunction(str) {
		let engine = this.engine;

		// Don’t use markdown as the engine to parse for symbols
		// TODO pass in engineOverride here
		if (this.#renderPreprocessorEngine) {
			engine = this.#renderPreprocessorEngine;
		}

		if ("parseForSymbols" in engine) {
			return () => {
				if (Array.isArray(str)) {
					return str
						.filter((entry) => typeof entry === "string")
						.map((entry) => engine.parseForSymbols(entry))
						.flat();
				}
				if (typeof str === "string") {
					return engine.parseForSymbols(str);
				}
				return [];
			};
		}
	}

	// used by computed data or for permalink functions
	async _renderFunction(fn, ...args) {
		let mixins = Object.assign({}, this.config.javascriptFunctions);
		let result = await fn.call(mixins, ...args);

		// normalize Buffer away if returned from permalink
		if (Buffer.isBuffer(result)) {
			return result.toString();
		}

		return result;
	}

	async renderComputedData(str, data) {
		if (typeof str === "function") {
			return this._renderFunction(str, data);
		}

		return this._render(str, data, {
			type: "Computed Data",
			bypassMarkdown: true,
		});
	}

	async renderPermalink(permalink, data) {
		let tr = await this.getTemplateRender();
		let permalinkCompilation = tr.engine.permalinkNeedsCompilation(permalink);

		// No string compilation:
		//    ({ compileOptions: { permalink: "raw" }})
		// These mean `permalink: false`, which is no file system writing:
		//    ({ compileOptions: { permalink: false }})
		//    ({ compileOptions: { permalink: () => false }})
		//    ({ compileOptions: { permalink: () => (() = > false) }})
		if (permalinkCompilation === false && typeof permalink !== "function") {
			return permalink;
		}

		/* Custom `compile` function for permalinks, usage:
		permalink: function(permalinkString, inputPath) {
			return async function(data) {
				return "THIS IS MY RENDERED PERMALINK";
			}
		}
		*/
		if (permalinkCompilation && typeof permalinkCompilation === "function") {
			permalink = await this._renderFunction(permalinkCompilation, permalink, this.inputPath);
		}

		// Raw permalink function (in the app code data cascade)
		if (typeof permalink === "function") {
			return this._renderFunction(permalink, data);
		}

		return this._render(permalink, data, {
			type: "Permalink",
			bypassMarkdown: true,
		});
	}

	async render(str, data, bypassMarkdown) {
		return this._render(str, data, {
			type: "Content",
			bypassMarkdown,
		});
	}

	_getPaginationLogSuffix(data) {
		let suffix = [];
		if ("pagination" in data) {
			suffix.push(" (");
			if (data.pagination.pages) {
				suffix.push(
					`${data.pagination.pages.length} page${data.pagination.pages.length !== 1 ? "s" : ""}`,
				);
			} else {
				suffix.push("Pagination");
			}
			suffix.push(")");
		}
		return suffix.join("");
	}

	async _render(str, data, options = {}) {
		let { bypassMarkdown, type } = options;

		try {
			if (bypassMarkdown && !this.engine.needsCompilation(str)) {
				return str;
			}

			let fn = await this.compile(str, {
				bypassMarkdown,
				engineOverride: data[this.config.keys.engineOverride],
				type,
			});

			if (fn === undefined) {
				return;
			} else if (typeof fn !== "function") {
				throw new Error(`The \`compile\` function did not return a function. Received ${fn}`);
			}

			// Benchmark
			let templateBenchmark = this.bench.get("Render");
			let inputPathBenchmark = this.bench.get(
				`> Render${type ? ` ${type}` : ""} > ${this.inputPath}${this._getPaginationLogSuffix(data)}`,
			);

			templateBenchmark.before();
			if (inputPathBenchmark) {
				inputPathBenchmark.before();
			}

			let rendered = await fn(data);

			if (inputPathBenchmark) {
				inputPathBenchmark.after();
			}
			templateBenchmark.after();

			return rendered;
		} catch (e) {
			if (ErrorUtil.isPrematureTemplateContentError(e)) {
				return Promise.reject(e);
			} else {
				let tr = await this.getTemplateRender();
				let engine = tr.getReadableEnginesList();
				debug(`Having trouble rendering ${engine} template ${this.inputPath}: %O`, str);
				return Promise.reject(
					new TemplateContentRenderError(
						`Having trouble rendering ${engine} template ${this.inputPath}`,
						e,
					),
				);
			}
		}
	}

	getExtensionEntries() {
		return this.engine.extensionEntries;
	}

	isFileRelevantToThisTemplate(incrementalFile, metadata = {}) {
		// always relevant if incremental file not set (build everything)
		if (!incrementalFile) {
			return true;
		}

		let hasDependencies = this.engine.hasDependencies(incrementalFile);

		let isRelevant = this.engine.isFileRelevantTo(this.inputPath, incrementalFile);

		debug(
			"Test dependencies to see if %o is relevant to %o: %o",
			this.inputPath,
			incrementalFile,
			isRelevant,
		);

		let extensionEntries = this.getExtensionEntries().filter((entry) => !!entry.isIncrementalMatch);
		if (extensionEntries.length) {
			for (let entry of extensionEntries) {
				if (
					entry.isIncrementalMatch.call(
						{
							inputPath: this.inputPath,
							isFullTemplate: metadata.isFullTemplate,
							isFileRelevantToInputPath: isRelevant,
							doesFileHaveDependencies: hasDependencies,
						},
						incrementalFile,
					)
				) {
					return true;
				}
			}

			return false;
		} else {
			// Not great way of building all templates if this is a layout, include, JS dependency.
			// TODO improve this for default template syntaxes

			// This is the fallback way of determining if something is incremental (no isIncrementalMatch available)
			// This will be true if the inputPath and incrementalFile are the same
			if (isRelevant) {
				return true;
			}

			// only return true here if dependencies are not known
			if (!hasDependencies && !metadata.isFullTemplate) {
				return true;
			}
		}

		return false;
	}
}

TemplateContent._inputCache = new Map();
TemplateContent._compileCache = new Map();
eventBus.on("buildawesome.resourcemodified", (path) => {
	// delete from input cache
	TemplateContent.deleteFromInputCache(path);

	// delete from compile cache
	let normalized = TemplatePath.addLeadingDotSlash(path);
	let compileCache = TemplateContent._compileCache.get(normalized);
	if (compileCache) {
		compileCache.clear();
	}
});

// Used when the configuration file reset https://github.com/11ty/eleventy/issues/2147
eventBus.on("buildawesome.compilecachereset", () => {
	TemplateContent._compileCache = new Map();
});

export default TemplateContent;
