import BaseError from "./Errors/BaseError.js";
import TemplateEngineManager from "./Engines/TemplateEngineManager.js";
import { createDebug } from "./Util/DebugLogUtil.js";

const debugConfiguration = createDebug("UserConfig");

class TemplateRenderUnknownEngineError extends BaseError {}

// works with full path names or short engine name
export default class TemplateRender {
	#extensionMap;
	#config;

	constructor(tmplPath, config) {
		if (!tmplPath) {
			throw new Error(`TemplateRender requires a tmplPath argument, instead of ${tmplPath}`);
		}
		this.#setConfig(config);

		this.engineNameOrPath = tmplPath;
		this.parseMarkdownWith = this.config.markdownTemplateEngine;
		if (this.parseMarkdownWith === "md") {
			this.parseMarkdownWith = false;
			debugConfiguration(
				"Misconfiguration warning: the preprocessing template syntax for Markdown files cannot be Markdown, we’re assuming you meant `false` to skip preprocessing altogether (via the `markdownTemplateEngine` configuration property or the `setMarkdownTemplateEngine` configuration method). Read more: https://www.11ty.dev/docs/config/#default-template-engine-for-markdown-files",
			);
		}
		this.parseHtmlWith = this.config.htmlTemplateEngine;
	}

	#setConfig(config) {
		if (config?.constructor?.name !== "TemplateConfig") {
			throw new Error("TemplateRender must receive a TemplateConfig instance.");
		}

		this.eleventyConfig = config;
		this.config = config.getConfig();
	}

	get dirs() {
		return this.eleventyConfig.directories;
	}

	get inputDir() {
		return this.dirs.input;
	}

	get includesDir() {
		return this.dirs.includes;
	}

	/* Backwards compat */
	getIncludesDir() {
		return this.includesDir;
	}

	get config() {
		return this.#config;
	}

	set config(config) {
		this.#config = config;
	}

	set extensionMap(extensionMap) {
		this.#extensionMap = extensionMap;
	}

	get extensionMap() {
		if (!this.#extensionMap) {
			throw new Error("Internal error: missing `extensionMap` in TemplateRender.");
		}
		return this.#extensionMap;
	}

	async getEngineByName(name) {
		// WARNING: eleventyConfig assignment removed here
		return this.extensionMap.engineManager.getEngine(name, this.extensionMap);
	}

	// Runs once per template
	async init(engineNameOrPath) {
		let name = engineNameOrPath || this.engineNameOrPath;
		this.extensionMap.setTemplateConfig(this.eleventyConfig);

		let extensionEntry = this.extensionMap.getExtensionEntry(name);
		let engineName = extensionEntry?.aliasKey || extensionEntry?.key;
		if (TemplateEngineManager.isSimpleAlias(extensionEntry)) {
			engineName = extensionEntry?.key;
		}
		this._engineName = engineName;

		if (!extensionEntry || !this._engineName) {
			throw new TemplateRenderUnknownEngineError(
				`Unknown engine for ${name} (supported extensions: ${this.extensionMap.getReadableFileExtensions()})`,
			);
		}

		this._engine = await this.getEngineByName(this._engineName);

		if (this.useMarkdown === undefined) {
			this.setUseMarkdown(this._engineName === "md");
		}
	}

	get engineName() {
		if (!this._engineName) {
			throw new Error("TemplateRender needs a call to the init() method.");
		}
		return this._engineName;
	}

	get engine() {
		if (!this._engine) {
			throw new Error("TemplateRender needs a call to the init() method.");
		}
		return this._engine;
	}

	static parseEngineOverrides(engineName) {
		if (typeof (engineName || "") !== "string") {
			throw new Error("Expected String passed to parseEngineOverrides. Received: " + engineName);
		}

		let overlappingEngineWarningCount = 0;
		let engines = [];
		let uniqueLookup = {};
		let usingMarkdown = false;
		(engineName || "")
			.split(",")
			.map((name) => {
				return name.toLowerCase().trim();
			})
			.forEach((name) => {
				// html is assumed (treated as plaintext by the system)
				if (!name || name === "html") {
					return;
				}

				if (name === "md") {
					usingMarkdown = true;
					return;
				}

				if (!uniqueLookup[name]) {
					engines.push(name);
					uniqueLookup[name] = true;

					// we already short circuit md and html types above
					overlappingEngineWarningCount++;
				}
			});

		if (overlappingEngineWarningCount > 1) {
			throw new Error(
				`Don’t mix multiple templating engines in your front matter overrides (exceptions for HTML and Markdown). You used: ${engineName}`,
			);
		}

		// markdown should always be first
		if (usingMarkdown) {
			engines.unshift("md");
		}

		return engines;
	}

	// used for error logging and console output.
	getReadableEnginesList() {
		return this.getReadableEnginesListDifferingFromFileExtension() || this.engineName;
	}

	getReadableEnginesListDifferingFromFileExtension() {
		let keyFromFilename = this.extensionMap.getKey(this.engineNameOrPath);
		if (this.engine?.constructor?.name === "CustomEngine") {
			if (
				this.engine.entry &&
				this.engine.entry.name &&
				keyFromFilename !== this.engine.entry.name
			) {
				return this.engine.entry.name;
			} else {
				// We don’t have a name for it so we return nothing so we don’t misreport (per #2386)
				return;
			}
		}

		if (this.engineName === "md" && this.useMarkdown && this.parseMarkdownWith) {
			return this.parseMarkdownWith;
		}
		if (this.engineName === "html" && this.parseHtmlWith) {
			return this.parseHtmlWith;
		}

		// templateEngineOverride in play and template language differs from file extension
		if (keyFromFilename !== this.engineName) {
			return this.engineName;
		}
	}

	// TODO templateEngineOverride
	getPreprocessorEngineName() {
		if (this.engineName === "md" && this.parseMarkdownWith) {
			return this.parseMarkdownWith;
		}
		if (this.engineName === "html" && this.parseHtmlWith) {
			return this.parseHtmlWith;
		}
		// TODO do we need this?
		return this.extensionMap.getKey(this.engineNameOrPath);
	}

	// We pass in templateEngineOverride here because it isn’t yet applied to templateRender
	getEnginesList(engineOverride) {
		if (engineOverride) {
			let engines = TemplateRender.parseEngineOverrides(engineOverride).reverse();
			return engines.join(",");
		}

		if (this.engineName === "md" && this.useMarkdown && this.parseMarkdownWith) {
			return `${this.parseMarkdownWith},md`;
		}
		if (this.engineName === "html" && this.parseHtmlWith) {
			return this.parseHtmlWith;
		}

		// templateEngineOverride in play
		return this.extensionMap.getKey(this.engineNameOrPath);
	}

	async setEngineOverride(engineName, bypassMarkdown) {
		let engines = TemplateRender.parseEngineOverrides(engineName);

		// when overriding, Template Engines with HTML will instead use the Template Engine as primary and output HTML
		// So any HTML engine usage here will never use a preprocessor templating engine.
		this.setHtmlEngine(false);

		if (!engines.length) {
			await this.init("html");
			return;
		}

		await this.init(engines[0]);

		let usingMarkdown = engines[0] === "md" && !bypassMarkdown;

		this.setUseMarkdown(usingMarkdown);

		if (usingMarkdown) {
			// false means only parse markdown and not with a preprocessor template engine
			this.setMarkdownEngine(engines.length > 1 ? engines[1] : false);
		}
	}

	getEngineName() {
		return this.engineName;
	}

	isEngine(engine) {
		return this.engineName === engine;
	}

	setUseMarkdown(useMarkdown) {
		this.useMarkdown = !!useMarkdown;
	}

	// this is only called for templateEngineOverride
	setMarkdownEngine(markdownEngine) {
		this.parseMarkdownWith = markdownEngine;
	}

	// this is only called for templateEngineOverride
	setHtmlEngine(htmlEngineName) {
		this.parseHtmlWith = htmlEngineName;
	}

	async _testRender(str, data) {
		return this.engine._testRender(str, data);
	}

	async getCompiledTemplate(str) {
		// TODO refactor better, move into TemplateEngine logic
		if (this.engineName === "md") {
			return this.engine.compile(
				str,
				this.engineNameOrPath,
				this.parseMarkdownWith,
				!this.useMarkdown,
			);
		} else if (this.engineName === "html") {
			return this.engine.compile(str, this.engineNameOrPath, this.parseHtmlWith);
		} else {
			return this.engine.compile(str, this.engineNameOrPath);
		}
	}
}
