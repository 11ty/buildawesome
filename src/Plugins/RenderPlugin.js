import { readFileSync } from "node:fs";
import { Merge, TemplatePath, isPlainObject } from "@11ty/eleventy-utils";

// TODO add a first-class Markdown component to expose this using Markdown-only syntax (will need to be synchronous for markdown-it)

import { ProxyWrap } from "../Util/Objects/ProxyWrap.js";
import TemplateDataInitialGlobalData from "../Data/TemplateDataInitialGlobalData.js";
import EleventyBaseError from "../Errors/EleventyBaseError.js";
import TemplateRender from "../TemplateRender.js";
import ProjectDirectories from "../Util/ProjectDirectories.js";
import TemplateConfig from "../TemplateConfig.js";
import EleventyExtensionMap from "../EleventyExtensionMap.js";
import TemplateEngineManager from "../Engines/TemplateEngineManager.js";
import Liquid from "../Adapters/Engines/Liquid.js";

class EleventyNunjucksError extends EleventyBaseError {}

const compileCache = new WeakMap();
const compileFileCache = new WeakMap();

/** @this {object} */
async function compile(content, templateLang, options = {}) {
	let { templateConfig, extensionMap } = options;
	let strictMode = options.strictMode ?? false;

	if (!templateConfig) {
		templateConfig = new TemplateConfig(null, false);
		templateConfig.setDirectories(new ProjectDirectories());
		await templateConfig.init();
	}

	// Breaking change in 2.0+, previous default was `html` and now we default to the page template syntax
	if (!templateLang) {
		templateLang = this.page.templateSyntax;
	}

	if (!compileCache.has(templateConfig)) {
		compileCache.set(templateConfig, new Map());
	}
	let projectCache = compileCache.get(templateConfig);
	let cacheKey = `${content}###${templateLang || ""}`;
	if (projectCache.has(cacheKey)) {
		return projectCache.get(cacheKey);
	}

	if (!extensionMap) {
		if (strictMode) {
			throw new Error("Internal error: missing `extensionMap` in RenderPlugin->compile.");
		}
		extensionMap = new EleventyExtensionMap(templateConfig);
		extensionMap.engineManager = new TemplateEngineManager(templateConfig);
	}
	let tr = new TemplateRender(templateLang, templateConfig);
	tr.extensionMap = extensionMap;

	if (templateLang) {
		await tr.setEngineOverride(templateLang);
	} else {
		await tr.init();
	}

	// TODO tie this to the class, not the extension
	if (
		tr.engine.name === "11ty.js" ||
		tr.engine.name === "11ty.cjs" ||
		tr.engine.name === "11ty.mjs" ||
		// TODO Node 22+
		tr.engine.name === "11ty.ts" ||
		tr.engine.name === "11ty.cts" ||
		tr.engine.name === "11ty.mts"
	) {
		throw new Error(
			"11ty.js is not yet supported as a template engine for `renderTemplate`. Use `renderFile` instead!",
		);
	}

	let fn = await tr.getCompiledTemplate(content);
	projectCache.set(cacheKey, fn);
	return fn;
}

// No templateLang default, it should infer from the inputPath.
async function compileFile(inputPath, options = {}, templateLang) {
	let { templateConfig, extensionMap, config } = options;
	let strictMode = options.strictMode ?? false;
	if (!inputPath) {
		throw new Error("Missing file path argument passed to the `renderFile` shortcode.");
	}

	let wasTemplateConfigMissing = false;
	if (!templateConfig) {
		templateConfig = new TemplateConfig(null, false);
		templateConfig.setDirectories(new ProjectDirectories());
		wasTemplateConfigMissing = true;
	}
	if (config && typeof config === "function") {
		await config(templateConfig.userConfig);
	}
	if (wasTemplateConfigMissing) {
		await templateConfig.init();
	}

	let normalizedPath = TemplatePath.normalizeOperatingSystemFilePath(inputPath);
	// Prefer the exists cache, if it’s available
	if (!templateConfig.existsCache.exists(normalizedPath)) {
		throw new Error(
			"Could not find render plugin file for the `renderFile` shortcode, looking for: " + inputPath,
		);
	}

	if (!compileFileCache.has(templateConfig)) {
		compileFileCache.set(templateConfig, new Map());
	}
	let projectCache = compileFileCache.get(templateConfig);
	let cacheKey = `${normalizedPath}###${templateLang || ""}`;

	if (!extensionMap) {
		if (strictMode) {
			throw new Error("Internal error: missing `extensionMap` in RenderPlugin->compileFile.");
		}

		extensionMap = new EleventyExtensionMap(templateConfig);
		extensionMap.engineManager = new TemplateEngineManager(templateConfig);
	}
	let tr = new TemplateRender(inputPath, templateConfig);
	tr.extensionMap = extensionMap;

	if (templateLang) {
		await tr.setEngineOverride(templateLang);
	} else {
		await tr.init();
	}

	if (!tr.engine.needsToReadFileContents()) {
		let fn = await tr.getCompiledTemplate(null);
		// Note: we don't cache these yet, but we could.
		return fn;
	}

	// TODO we could make this work with full templates (with front matter?)
	let content = readFileSync(inputPath, "utf8");

	if (projectCache.has(cacheKey)) {
		let cached = projectCache.get(cacheKey);
		if (cached.content === content) {
			return cached.fn;
		}
	}

	let fn = await tr.getCompiledTemplate(content);
	projectCache.set(cacheKey, {
		content,
		fn,
	});
	return fn;
}

/** @this {object} */
async function renderShortcodeFn(fn, data) {
	if (fn === undefined) {
		return;
	} else if (typeof fn !== "function") {
		throw new Error(`The \`compile\` function did not return a function. Received ${fn}`);
	}

	// if the user passes a string or other literal, remap to an object.
	if (!isPlainObject(data)) {
		data = {
			_: data,
		};
	}

	if ("data" in this && isPlainObject(this.data)) {
		// when options.accessGlobalData is true, this allows the global data
		// to be accessed inside of the shortcode as a fallback

		data = ProxyWrap(data, this.data);
	} else {
		// save `page` and `eleventy` for reuse
		data.page = this.page;
		data.eleventy = this.eleventy;
	}

	return fn(data);
}

/**
 * @module 11ty/eleventy/Plugins/RenderPlugin
 */

/**
 * A plugin to add shortcodes to render an Eleventy template
 * string (or file) inside of another template. {@link https://v3.11ty.dev/docs/plugins/render/}
 *
 * @since 1.0.0
 * @param {module:11ty/eleventy/UserConfig} eleventyConfig - User-land configuration instance.
 * @param {object} options - Plugin options
 */
function RenderPlugin(eleventyConfig, options = {}) {
	let templateConfig;
	eleventyConfig.on("eleventy.config", (tmplConfigInstance) => {
		templateConfig = tmplConfigInstance;
	});

	let extensionMap;
	eleventyConfig.on("eleventy.extensionmap", (map) => {
		extensionMap = map;
	});

	/**
	 * @typedef {object} options
	 * @property {string} [tagName] - The shortcode name to render a template string.
	 * @property {string} [tagNameFile] - The shortcode name to render a template file.
	 * @property {module:11ty/eleventy/TemplateConfig} [templateConfig] - Configuration object
	 * @property {boolean} [accessGlobalData] - Whether or not the template has access to the page’s data.
	 */

	options.tagName ??= "renderTemplate";
	options.tagNameFile ??= "renderFile";
	options.filterName ??= "renderContent";
	options.templateConfig ??= null;
	options.accessGlobalData ??= false;

	function liquidTemplateTag(liquidEngine, tagName, extras) {
		const { evalToken } = extras;
		// via https://github.com/harttle/liquidjs/blob/b5a22fa0910c708fe7881ef170ed44d3594e18f3/src/builtin/tags/raw.ts
		return {
			parse: function (tagToken, remainTokens) {
				this.name = tagToken.name;

				if (eleventyConfig.liquid.parameterParsing === "builtin") {
					this.orderedArgs = Liquid.parseArgumentsBuiltin(tagToken.args);
					// note that Liquid does have a Hash class for name-based argument parsing but offers no easy to support both modes in one class
				} else {
					this.legacyArgs = tagToken.args;
				}

				this.tokens = [];

				var stream = liquidEngine.parser
					.parseStream(remainTokens)
					.on("token", (token) => {
						if (token.name === "end" + tagName) stream.stop();
						else this.tokens.push(token);
					})
					.on("end", () => {
						throw new Error(`tag ${tagToken.getText()} not closed`);
					});

				stream.start();
			},
			render: function* (ctx) {
				let normalizedContext = {};
				if (ctx) {
					if (options.accessGlobalData) {
						// parent template data cascade
						normalizedContext.data = ctx.getAll();
					}

					normalizedContext.page = ctx.get(["page"]);
					normalizedContext.eleventy = ctx.get(["eleventy"]);
				}

				let argArray = [];
				if (this.legacyArgs) {
					let rawArgs = Liquid.parseArguments(null, this.legacyArgs);
					for (let arg of rawArgs) {
						let b = yield liquidEngine.evalValue(arg, ctx);
						argArray.push(b);
					}
				} else if (this.orderedArgs) {
					for (let arg of this.orderedArgs) {
						let b = yield evalToken(arg, ctx);
						argArray.push(b);
					}
				}

				// plaintext paired shortcode content
				let body = this.tokens.map((token) => token.getText()).join("");

				let ret = _renderStringShortcodeFn.call(
					normalizedContext,
					body,
					// templateLang, data
					...argArray,
				);
				yield ret;
				return ret;
			},
		};
	}

	// TODO I don’t think this works with whitespace control, e.g. {%- endrenderTemplate %}
	function nunjucksTemplateTag(NunjucksLib, tagName) {
		return new (function () {
			this.tags = [tagName];

			this.parse = function (parser, nodes) {
				var tok = parser.nextToken();

				var args = parser.parseSignature(true, true);
				const begun = parser.advanceAfterBlockEnd(tok.value);

				// This code was ripped from the Nunjucks parser for `raw`
				// https://github.com/mozilla/nunjucks/blob/fd500902d7c88672470c87170796de52fc0f791a/nunjucks/src/parser.js#L655
				const endTagName = "end" + tagName;
				// Look for upcoming raw blocks (ignore all other kinds of blocks)
				const rawBlockRegex = new RegExp(
					"([\\s\\S]*?){%\\s*(" + tagName + "|" + endTagName + ")\\s*(?=%})%}",
				);
				let rawLevel = 1;
				let str = "";
				let matches;

				// Exit when there's nothing to match
				// or when we've found the matching "endraw" block
				while ((matches = parser.tokens._extractRegex(rawBlockRegex)) && rawLevel > 0) {
					const all = matches[0];
					const pre = matches[1];
					const blockName = matches[2];

					// Adjust rawlevel
					if (blockName === tagName) {
						rawLevel += 1;
					} else if (blockName === endTagName) {
						rawLevel -= 1;
					}

					// Add to str
					if (rawLevel === 0) {
						// We want to exclude the last "endraw"
						str += pre;
						// Move tokenizer to beginning of endraw block
						parser.tokens.backN(all.length - pre.length);
					} else {
						str += all;
					}
				}

				let body = new nodes.Output(begun.lineno, begun.colno, [
					new nodes.TemplateData(begun.lineno, begun.colno, str),
				]);
				return new nodes.CallExtensionAsync(this, "run", args, [body]);
			};

			this.run = function (...args) {
				let resolve = args.pop();
				let body = args.pop();
				let [context, ...argArray] = args;

				let normalizedContext = {};
				if (context.ctx?.page) {
					normalizedContext.ctx = context.ctx;

					// TODO .data
					// if(options.accessGlobalData) {
					//   normalizedContext.data = context.ctx;
					// }

					normalizedContext.page = context.ctx.page;
					normalizedContext.eleventy = context.ctx.eleventy;
				}

				body(function (e, bodyContent) {
					if (e) {
						resolve(
							new EleventyNunjucksError(`Error with Nunjucks paired shortcode \`${tagName}\``, e),
						);
					}

					Promise.resolve(
						_renderStringShortcodeFn.call(
							normalizedContext,
							bodyContent,
							// templateLang, data
							...argArray,
						),
					).then(
						function (returnValue) {
							resolve(null, new NunjucksLib.runtime.SafeString(returnValue));
						},
						function (e) {
							resolve(
								new EleventyNunjucksError(`Error with Nunjucks paired shortcode \`${tagName}\``, e),
								null,
							);
						},
					);
				});
			};
		})();
	}

	/** @this {object} */
	async function _renderStringShortcodeFn(content, templateLang, data = {}) {
		// Default is fn(content, templateLang, data) but we want to support fn(content, data) too
		if (typeof templateLang !== "string") {
			data = templateLang;
			templateLang = false;
		}

		// TODO Render plugin `templateLang` is feeding bad input paths to the addDependencies call in Custom.js
		let fn = await compile.call(this, content, templateLang, {
			templateConfig: options.templateConfig || templateConfig,
			extensionMap,
		});

		return renderShortcodeFn.call(this, fn, data);
	}

	/** @this {object} */
	async function _renderFileShortcodeFn(inputPath, data = {}, templateLang) {
		let renderFileOptions = {
			templateConfig: options.templateConfig || templateConfig,
			extensionMap,
		};

		let fn = await compileFile.call(this, inputPath, renderFileOptions, templateLang);

		return renderShortcodeFn.call(this, fn, data);
	}

	// Render strings
	if (options.tagName) {
		// use falsy to opt-out
		eleventyConfig.addJavaScriptFunction(options.tagName, _renderStringShortcodeFn);

		eleventyConfig.addLiquidTag(options.tagName, function (liquidEngine, extras) {
			return liquidTemplateTag(liquidEngine, options.tagName, extras);
		});

		eleventyConfig.addNunjucksTag(options.tagName, function (nunjucksLib) {
			return nunjucksTemplateTag(nunjucksLib, options.tagName);
		});
	}

	// Filter for rendering strings
	if (options.filterName) {
		eleventyConfig.addAsyncFilter(options.filterName, _renderStringShortcodeFn);
	}

	// Render File
	// use `false` to opt-out
	if (options.tagNameFile) {
		eleventyConfig.addAsyncShortcode(options.tagNameFile, _renderFileShortcodeFn);
	}
}

// Will re-use the same configuration instance both at a top level and across any nested renders
class RenderManager {
	/** @type {Promise|undefined} */
	#hasConfigInitialized;
	#extensionMap;
	#templateConfig;

	constructor() {
		this.templateConfig = new TemplateConfig(null, false);
		this.templateConfig.setDirectories(new ProjectDirectories());
	}

	get templateConfig() {
		return this.#templateConfig;
	}

	set templateConfig(templateConfig) {
		if (!templateConfig || templateConfig === this.#templateConfig) {
			return;
		}

		this.#templateConfig = templateConfig;

		// This is the only plugin running on the Edge
		this.#templateConfig.userConfig.addPlugin(RenderPlugin, {
			templateConfig: this.#templateConfig,
			accessGlobalData: true,
		});

		this.#extensionMap = new EleventyExtensionMap(this.#templateConfig);
		this.#extensionMap.engineManager = new TemplateEngineManager(this.#templateConfig);
	}

	async init() {
		if (this.#hasConfigInitialized) {
			return this.#hasConfigInitialized;
		}
		if (this.templateConfig.hasInitialized()) {
			return true;
		}
		this.#hasConfigInitialized = this.templateConfig.init();
		await this.#hasConfigInitialized;

		return true;
	}

	// `callback` is async-friendly but requires await upstream
	config(callback) {
		// run an extra `function(eleventyConfig)` configuration callbacks
		if (callback && typeof callback === "function") {
			return callback(this.templateConfig.userConfig);
		}
	}

	get initialGlobalData() {
		if (!this._data) {
			this._data = new TemplateDataInitialGlobalData(this.templateConfig);
		}
		return this._data;
	}

	// because we don’t have access to the full data cascade—but
	// we still want configuration data added via `addGlobalData`
	async getData(...data) {
		await this.init();

		let globalData = await this.initialGlobalData.getData();
		let merged = Merge({}, globalData, ...data);
		return merged;
	}

	async compile(content, templateLang, options = {}) {
		await this.init();

		options.templateConfig = this.templateConfig;
		options.extensionMap = this.#extensionMap;
		options.strictMode = true;

		// We don’t need `compile.call(this)` here because the Edge always uses "liquid" as the template lang (instead of relying on this.page.templateSyntax)
		// returns promise
		return compile(content, templateLang, options);
	}

	async render(fn, edgeData, buildTimeData) {
		await this.init();

		let mergedData = await this.getData(edgeData);
		// Set .data for options.accessGlobalData feature
		let context = {
			data: mergedData,
		};

		return renderShortcodeFn.call(context, fn, buildTimeData);
	}
}

Object.defineProperty(RenderPlugin, "eleventyPackage", {
	value: "@11ty/eleventy/render-plugin",
});

Object.defineProperty(RenderPlugin, "eleventyPluginOptions", {
	value: {
		unique: true,
	},
});

// CommonJS friendly exports on .default
Object.assign(RenderPlugin, {
	File: compileFile,
	String: compile,
	RenderManager,
});

export default RenderPlugin;

export { compileFile as File, compile as String, RenderManager };
