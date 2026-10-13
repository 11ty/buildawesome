import BaseError from "./Errors/BaseError.js";
import TemplateEngineManager from "./Engines/TemplateEngineManager.js";
import { TemplatePipeline } from "./TemplatePipeline.js";

class TemplateRenderUnknownEngineError extends BaseError {}

// works with full path names or short engine name
export default class TemplateRender {
	#extensionMap;
	#config;
	// Steps (engine names or instances) that run before the primary engine, in execution order
	#precedingSteps = [];

	constructor(tmplPath, config) {
		if (!tmplPath) {
			throw new Error(`TemplateRender requires a tmplPath argument, instead of ${tmplPath}`);
		}
		this.#setConfig(config);

		this.engineNameOrPath = tmplPath;
	}

	isFormat(engineName) {
		return TemplatePipeline.isFormat(engineName);
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

		this.#setPrecedingSteps(this.#getDefaultPrecedingSteps());
	}

	#getDefaultPrecedingSteps() {
		let chain = TemplatePipeline.getChain(this._engineName);
		if (!chain) {
			return [];
		}

		let preprocessor = TemplatePipeline.getPreprocessor(chain, this.config);
		return [...(preprocessor ? [preprocessor] : []), ...chain.slice(0, -1)];
	}

	#setPrecedingSteps(steps) {
		TemplatePipeline.validate([...TemplateRender.#getStepNames(steps), this._engineName]);
		this.#precedingSteps = steps;
	}

	static #getStepNames(steps) {
		return steps.map((step) => (typeof step === "string" ? step : step.getName()));
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

		if (this.#precedingSteps.length > 0) {
			return TemplateRender.#getStepNames(this.#precedingSteps).join(",");
		}

		// templateEngineOverride in play and template language differs from file extension
		if (keyFromFilename !== this.engineName) {
			return this.engineName;
		}
	}

	// The engine that compiles the template source (first step of the pipeline)
	getPreprocessorEngineName() {
		if (this.#precedingSteps.length > 0) {
			return TemplateRender.#getStepNames(this.#precedingSteps)[0];
		}
		return this.extensionMap.getKey(this.engineNameOrPath);
	}

	// We pass in templateEngineOverride here because it isn’t yet applied to templateRender
	getEnginesList(engineOverride) {
		if (engineOverride) {
			return TemplatePipeline.parse(engineOverride).join(",");
		}

		if (this.#precedingSteps.length > 0) {
			let names = TemplateRender.#getStepNames(this.#precedingSteps);
			if (this.engineName !== TemplatePipeline.PLAINTEXT_FORMAT) {
				names.push(this.engineName);
			}
			return names.join(",");
		}

		// templateEngineOverride in play
		return this.extensionMap.getKey(this.engineNameOrPath);
	}

	async setEngineOverride(engineName) {
		let steps = TemplatePipeline.parse(engineName);

		if (!steps.length) {
			await this.init(TemplatePipeline.PLAINTEXT_FORMAT);
			this.#setPrecedingSteps([]);
			return;
		}

		await this.init(steps.at(-1));
		this.#setPrecedingSteps(steps.slice(0, -1));
	}

	getEngineName() {
		return this.engineName;
	}

	isEngine(engine) {
		return this.engineName === engine;
	}

	// Replaces the template engine step: an engine name, engine instance, or `false` to skip it
	setPreprocessingEngine(engine) {
		let formatSteps = this.#precedingSteps.filter(
			(step) => typeof step === "string" && this.isFormat(step),
		);
		this.#setPrecedingSteps([...(engine ? [engine] : []), ...formatSteps]);
	}

	async #getEngine(step) {
		if (typeof step === "string") {
			return this.getEngineByName(step);
		}
		return step;
	}

	// Engine names in execution order
	getPipelineStepNames() {
		return [...TemplateRender.#getStepNames(this.#precedingSteps), this.engineName];
	}

	// Removes output format steps, e.g. for permalinks and computed data
	static #getTemplateOnlySteps(steps, engineName, config) {
		let names = [...TemplateRender.#getStepNames(steps.slice(0, -1)), engineName];
		let templateSteps = steps.filter((step, j) => !TemplatePipeline.isFormat(names[j]));

		// e.g. permalinks with `templateEngineOverride: md` use the format’s default preprocessor (#446)
		let chain = TemplatePipeline.getChain(engineName);
		if (templateSteps.length === 0 && chain) {
			let preprocessor = TemplatePipeline.getPreprocessor(chain, config);
			return preprocessor ? [preprocessor] : [];
		}

		return templateSteps;
	}

	async _testRender(str, data) {
		return this.engine._testRender(str, data);
	}

	// `templateOnly` skips the output format step (e.g. Markdown) for permalinks and computed data
	async getCompiledTemplate(str, { templateOnly = false } = {}) {
		let steps = [...this.#precedingSteps, this.engine];
		if (templateOnly) {
			steps = TemplateRender.#getTemplateOnlySteps(steps, this.engineName, this.config);
		}

		if (steps.length === 0) {
			return function () {
				return str;
			};
		}

		let [first, ...rest] = await Promise.all(steps.map((step) => this.#getEngine(step)));
		let inputPath = this.engineNameOrPath;
		let fnReady = first.compile(str, inputPath);

		if (rest.length === 0) {
			return fnReady;
		}

		await Promise.all(rest.map((engine) => engine.ready()));

		// Later steps compile the previous step’s output on every render
		return async function (data, renderContext) {
			let fn = await fnReady;
			let content = await fn(data);
			for (let engine of rest) {
				renderContext?.stepInputs?.push(content);
				let nextFn = await engine.compile(content, inputPath);
				content = await nextFn(data);
			}
			return content;
		};
	}
}
