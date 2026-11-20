import { readFileSync } from "node:fs";
import matter from "@11ty/gray-matter";
import { TemplatePath, isPlainObject } from "@11ty/eleventy-utils";

// TODO add a first-class Markdown component to expose this using Markdown-only syntax (will need to be synchronous for markdown-it)

import { ProxyWrap } from "../Util/Objects/ProxyWrap.js";
import BaseError from "../Errors/BaseError.js";
import TemplateRender from "../TemplateRender.js";
import TemplateContent from "../TemplateContent.js";
import ProjectDirectories from "../Util/ProjectDirectories.js";
import TemplateConfig from "../TemplateConfig.js";
import ExtensionMap from "../ExtensionMap.js";
import TemplateEngineManager from "../Engines/TemplateEngineManager.js";
import Liquid from "../Adapters/Engines/Liquid.js";
import memoize from "../Util/MemoizeFunction.js";

class NunjucksError extends BaseError {}

const fallbackExtensionMaps = new WeakMap();

// One map per config: a new engine manager per call would leave its engines (and their listeners) behind
function getFallbackExtensionMap(templateConfig) {
	let extensionMap = fallbackExtensionMaps.get(templateConfig);
	if (!extensionMap) {
		extensionMap = new ExtensionMap(templateConfig);
		extensionMap.engineManager = new TemplateEngineManager(templateConfig);
		fallbackExtensionMaps.set(templateConfig, extensionMap);

		// Same invalidation as the memoized compile cache below
		let reset = () => extensionMap.reset();
		templateConfig.eventBus.on("buildawesome.resourcemodified", reset);
		templateConfig.eventBus.on("buildawesome.compilecachereset", reset);
	}

	return extensionMap;
}

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
		templateLang = this?.page?.templateSyntax;
	}

	if (!extensionMap) {
		if (strictMode) {
			throw new Error("Internal error: missing `extensionMap` in RenderPlugin->compile.");
		}
		extensionMap = getFallbackExtensionMap(templateConfig);
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

	return tr.getCompiledTemplate(content);
}

async function readFrontMatter(inputPath, templateConfig) {
	let content = readFileSync(inputPath, "utf8");
	let options = new TemplateContent(inputPath, templateConfig).getFrontMatterParsingOptions();
	options.filePath = inputPath;
	// Excerpts are a page-level feature.
	options.excerpt = false;

	try {
		let fm = matter(content, options);
		return { content: fm.content, data: await fm.data };
	} catch (e) {
		throw new Error(`Having trouble reading front matter from \`renderFile\` target ${inputPath}`, {
			cause: e,
		});
	}
}

// No templateLang default, it should infer from the inputPath.
async function compileFile(inputPath, options = {}, templateLang) {
	let { fn, data: frontMatterData } = await compileFileWithFrontMatter(
		inputPath,
		options,
		templateLang,
	);
	if (typeof fn !== "function" || !frontMatterData) {
		return fn;
	}

	return (data) =>
		fn(data === undefined || isPlainObject(data) ? { ...frontMatterData, ...data } : data);
}

// Front matter is returned separately so the shortcode can layer it between passed data and global data.
async function compileFileWithFrontMatter(inputPath, options = {}, templateLang) {
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

	if (!extensionMap) {
		if (strictMode) {
			throw new Error("Internal error: missing `extensionMap` in RenderPlugin->compileFile.");
		}

		extensionMap = getFallbackExtensionMap(templateConfig);
	}
	let tr = new TemplateRender(inputPath, templateConfig);
	tr.extensionMap = extensionMap;

	if (templateLang) {
		await tr.setEngineOverride(templateLang);
	} else {
		await tr.init();
	}

	if (!tr.engine.needsToReadFileContents()) {
		return { fn: await tr.getCompiledTemplate(null) };
	}

	let { content, data } = await readFrontMatter(inputPath, templateConfig);
	return {
		fn: await tr.getCompiledTemplate(content),
		data: isPlainObject(data) && Object.keys(data).length > 0 ? data : undefined,
	};
}

const memoizedCompiles = new WeakMap();

function memoizeCompile(templateConfig, key, compileFn) {
	let memoized = memoizedCompiles.get(templateConfig);
	if (!memoized) {
		memoized = memoize((key, compileFn) => compileFn(), { getCacheKey: (key) => key });
		// Clearing everything also covers changes to a rendered template’s includes.
		templateConfig.eventBus.on("buildawesome.resourcemodified", memoized.clear);
		templateConfig.eventBus.on("buildawesome.compilecachereset", memoized.clear);
		memoizedCompiles.set(templateConfig, memoized);
	}

	return memoized(key, compileFn);
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

	if (this && "data" in this && isPlainObject(this.data)) {
		// when options.accessGlobalData is true, this allows the global data
		// to be accessed inside of the shortcode as a fallback

		data = ProxyWrap(data, this.data);
	} else {
		// Context values are fallbacks; a copy avoids leaking one page’s context into a reused data object.
		data = {
			page: this?.page,
			eleventy: this?.eleventy,
			buildawesome: this?.buildawesome,
			...data,
		};
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
 * @param {module:11ty/eleventy/UserConfig} $config - User-land configuration instance.
 * @param {object} options - Plugin options
 */
function RenderPlugin($config, options = {}) {
	let templateConfig;
	$config.on("buildawesome.config", (tmplConfigInstance) => {
		templateConfig = tmplConfigInstance;
	});

	let extensionMap;
	$config.on("buildawesome.extensionmap", (map) => {
		extensionMap = map;
	});

	/**
	 * @typedef {object} options
	 * @property {string} [tagName] - The shortcode name to render a template string.
	 * @property {string} [tagNameFile] - The shortcode name to render a template file.
	 * @property {module:11ty/eleventy/TemplateConfig} [templateConfig] - Configuration object
	 * @property {boolean} [accessGlobalData] - Whether or not the template has access to the page’s data.
	 * @property {string} [memoize] - Comma-separated list (`file`, `string`) to reuse compiled `renderFile` and `renderTemplate`/`renderContent` templates across pages.
	 */

	// For incremental builds, the page uses what it renders
	function addDependency(page, ...nodes) {
		let uses = (options.templateConfig || templateConfig)?.usesGraph;
		if (uses && page?.inputPath) {
			uses.addDependency(page.inputPath, nodes.filter(Boolean));
		}
	}

	options.tagName ??= "renderTemplate";
	if (!/^\w+$/.test(options.tagName)) {
		throw new Error(
			`Invalid RenderPlugin \`tagName\` option: ${JSON.stringify(options.tagName)}. Use only letters, numbers and underscores.`,
		);
	}
	options.tagNameFile ??= "renderFile";
	options.filterName ??= "renderContent";
	options.templateConfig ??= null;
	options.accessGlobalData ??= false;
	let memoize = new Set((options.memoize || "").split(",").map((entry) => entry.trim()));

	function liquidTemplateTag(liquidEngine, tagName, extras) {
		const { evalToken } = extras;
		// via https://github.com/harttle/liquidjs/blob/b5a22fa0910c708fe7881ef170ed44d3594e18f3/src/builtin/tags/raw.ts
		return {
			parse: function (tagToken, remainTokens) {
				this.name = tagToken.name;

				if ($config.liquid.parameterParsing === "builtin") {
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
					normalizedContext.buildawesome = ctx.get(["buildawesome"]);
				}

				let argArray = [];
				if (this.legacyArgs) {
					let rawArgs = Liquid.parseArguments(this.legacyArgs);
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
				// Invalid `tagName` options already throw at setup, but never let a metacharacter into the regex.
				const safeTagName = tagName.replace(/\W/g, "");
				const safeEndTagName = "end" + safeTagName;
				// Look for upcoming raw blocks (ignore all other kinds of blocks)
				const rawBlockRegex = new RegExp(
					"([\\s\\S]*?){%\\s*(" + safeTagName + "|" + safeEndTagName + ")\\s*(?=%})%}",
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
					normalizedContext.buildawesome = context.ctx.buildawesome;
				}

				body(function (e, bodyContent) {
					if (e) {
						resolve(new NunjucksError(`Error with Nunjucks paired shortcode \`${tagName}\``, e));
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
								new NunjucksError(`Error with Nunjucks paired shortcode \`${tagName}\``, e),
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

		// Engines record a string template’s dependencies under the engine name (e.g. `njk` or `webc`)
		let lang = templateLang || this?.page?.templateSyntax;
		if (typeof lang === "string") {
			addDependency(this?.page, lang, ...lang.split(","));
		}

		let compileOptions = {
			templateConfig: options.templateConfig || templateConfig,
			extensionMap,
		};
		let compileFn = () => compile.call(this, content, templateLang, compileOptions);

		let fn;
		if (memoize.has("string") && compileOptions.templateConfig) {
			fn = await memoizeCompile(
				compileOptions.templateConfig,
				`string:${lang || ""}:${content}`,
				compileFn,
			);
		} else {
			fn = await compileFn();
		}

		return renderShortcodeFn.call(this, fn, data);
	}

	/** @this {object} */
	async function _renderFileShortcodeFn(inputPath, data = {}, templateLang) {
		let renderFileOptions = {
			templateConfig: options.templateConfig || templateConfig,
			extensionMap,
		};

		addDependency(this?.page, inputPath);

		let compiled;
		let compileFn = () => compileFileWithFrontMatter(inputPath, renderFileOptions, templateLang);
		if (memoize.has("file") && renderFileOptions.templateConfig) {
			compiled = await memoizeCompile(
				renderFileOptions.templateConfig,
				`file:${templateLang || ""}:${inputPath}`,
				compileFn,
			);
		} else {
			compiled = await compileFn();
		}

		if (compiled.data) {
			data = { ...compiled.data, ...(isPlainObject(data) ? data : { _: data }) };
		}

		return renderShortcodeFn.call(this, compiled.fn, data);
	}

	// Render strings
	if (options.tagName) {
		// use falsy to opt-out
		$config.addJavaScriptFunction(options.tagName, _renderStringShortcodeFn);

		$config.addLiquidTag(options.tagName, function (liquidEngine, extras) {
			return liquidTemplateTag(liquidEngine, options.tagName, extras);
		});

		$config.addNunjucksTag(options.tagName, function (nunjucksLib) {
			return nunjucksTemplateTag(nunjucksLib, options.tagName);
		});
	}

	// Filter for rendering strings
	if (options.filterName) {
		$config.addAsyncFilter(options.filterName, _renderStringShortcodeFn);
	}

	// Render File
	// use `false` to opt-out
	if (options.tagNameFile) {
		$config.addAsyncShortcode(options.tagNameFile, _renderFileShortcodeFn);
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

		this.#templateConfig.userConfig.addPlugin(RenderPlugin, {
			templateConfig: this.#templateConfig,
			accessGlobalData: true,
		});

		this.#extensionMap = new ExtensionMap(this.#templateConfig);
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
		// run an extra `function($config)` configuration callbacks
		if (callback && typeof callback === "function") {
			return callback(this.templateConfig.userConfig);
		}
	}

	async compile(content, templateLang, options = {}) {
		await this.init();

		options.templateConfig = this.templateConfig;
		options.extensionMap = this.#extensionMap;
		options.strictMode = true;

		// returns promise
		return compile(content, templateLang, options);
	}

	// Removed in v4 (Eleventy Edge leftovers)
	get initialGlobalData() {
		throw new Error(RenderManager.#removedMessage("initialGlobalData"));
	}

	getData() {
		throw new Error(RenderManager.#removedMessage("getData()"));
	}

	render() {
		throw new Error(RenderManager.#removedMessage("render()"));
	}

	static #removedMessage(name) {
		return `\`RenderManager#${name}\` was removed in v4 (it was only used by the Eleventy Edge plugin, removed in v3). Use \`compile()\` and call the returned function with your data instead.`;
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

// Legacy property access (e.g. `RenderPlugin.File`) for the root package exports.
Object.assign(RenderPlugin, {
	File: compileFile,
	String: compile,
	RenderManager,
});

export { RenderPlugin, compileFile as RenderFile, compile as RenderString, RenderManager };
