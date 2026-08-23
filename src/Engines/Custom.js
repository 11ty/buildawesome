import TemplateEngine from "./TemplateEngine.js";
import getJavaScriptData from "../Util/GetJavaScriptData.js";

export default class CustomEngine extends TemplateEngine {
	constructor(name, eleventyConfig) {
		super(name, eleventyConfig);

		this.entry = this.getExtensionMapEntry();
		this.needsInit = "init" in this.entry && typeof this.entry.init === "function";

		this.setDefaultEngine(undefined);

		this.previousQueue = [];
		this.config.events.on("buildawesome#previousqueue", (filePaths) => {
			this.previousQueue = filePaths;
		});
	}

	getExtensionMapEntry() {
		if ("extensionMap" in this.config) {
			let name = this.name.toLowerCase();
			// Iterates over only the user config `addExtension` entries
			for (let entry of this.config.extensionMap) {
				let entryKey = (entry.aliasKey || entry.key || "").toLowerCase();
				if (entryKey === name) {
					return entry;
				}
			}
		}

		throw Error(
			`Could not find a custom extension for ${this.name}. Did you add it to your config file?`,
		);
	}

	setDefaultEngine(defaultEngine) {
		this._defaultEngine = defaultEngine;
	}

	get cacheable() {
		// Enable cacheability for this template
		if (this.entry?.compileOptions?.cache !== undefined) {
			return this.entry.compileOptions.cache;
		} else if (this.needsToReadFileContents()) {
			return true;
		} else if (this._defaultEngine?.cacheable !== undefined) {
			return this._defaultEngine.cacheable;
		}

		return super.cacheable;
	}

	async getInstanceFromInputPath(inputPath) {
		if (
			"getInstanceFromInputPath" in this.entry &&
			typeof this.entry.getInstanceFromInputPath === "function"
		) {
			// returns Promise
			return this.entry.getInstanceFromInputPath(inputPath);
		}

		// aliased upstream type
		if (
			this._defaultEngine &&
			"getInstanceFromInputPath" in this._defaultEngine &&
			typeof this._defaultEngine.getInstanceFromInputPath === "function"
		) {
			// returns Promise
			return this._defaultEngine.getInstanceFromInputPath(inputPath);
		}

		return false;
	}

	/**
	 * Whether to use the module loader directly
	 *
	 * @override
	 */
	useJavaScriptImport() {
		if ("useJavaScriptImport" in this.entry) {
			return this.entry.useJavaScriptImport;
		}

		if (
			this._defaultEngine &&
			"useJavaScriptImport" in this._defaultEngine &&
			typeof this._defaultEngine.useJavaScriptImport === "function"
		) {
			return this._defaultEngine.useJavaScriptImport();
		}

		return false;
	}

	/**
	 * @override
	 */
	needsToReadFileContents() {
		if ("read" in this.entry) {
			return this.entry.read;
		}

		// Handle aliases to `11ty.js` templates, avoid reading files in the alias, see #2279
		// Here, we are short circuiting fallback to defaultRenderer, does not account for compile
		// functions that call defaultRenderer explicitly
		if (this._defaultEngine && "needsToReadFileContents" in this._defaultEngine) {
			return this._defaultEngine.needsToReadFileContents();
		}

		return true;
	}

	// If we init from multiple places, wait for the first init to finish before continuing on.
	async _runningInit() {
		if (this.needsInit) {
			if (!this._initing) {
				this._initBench = this.benchmarks.aggregate.get(`Engine (${this.name}) Init`);
				this._initBench.before();
				this._initing = this.entry.init.bind({
					config: this.config,
					bench: this.benchmarks.aggregate,
				})();
			}
			await this._initing;
			this.needsInit = false;

			if (this._initBench) {
				this._initBench.after();
				this._initBench = undefined;
			}
		}
	}

	async getExtraDataFromFile(inputPath) {
		if (this.entry.getData === false) {
			return;
		}

		if (!("getData" in this.entry)) {
			// Handle aliases to `11ty.js` templates, use upstream default engine data fetch, see #2279
			if (this._defaultEngine && "getExtraDataFromFile" in this._defaultEngine) {
				return this._defaultEngine.getExtraDataFromFile(inputPath);
			}

			return;
		}

		await this._runningInit();

		if (typeof this.entry.getData === "function") {
			let dataBench = this.benchmarks.aggregate.get(
				`Engine (${this.name}) Get Data From File (Function)`,
			);
			dataBench.before();
			let data = this.entry.getData(inputPath);
			dataBench.after();
			return data;
		}

		let keys = new Set();
		if (this.entry.getData === true) {
			keys.add("data");
		} else if (Array.isArray(this.entry.getData)) {
			for (let key of this.entry.getData) {
				keys.add(key);
			}
		}

		let dataBench = this.benchmarks.aggregate.get(`Engine (${this.name}) Get Data From File`);
		dataBench.before();

		let inst = await this.getInstanceFromInputPath(inputPath);

		if (inst === false) {
			dataBench.after();

			return Promise.reject(
				new Error(
					`\`getInstanceFromInputPath\` callback missing from '${this.name}' template engine plugin. It is required when \`getData\` is in use. You can set \`getData: false\` to opt-out of this.`,
				),
			);
		}

		// override keys set at the plugin level in the individual template
		if (inst.eleventyDataKey) {
			keys = new Set(inst.eleventyDataKey);
		}

		let mixins;
		if (this.config) {
			// Object.assign usage: see TemplateRenderCustomTest.js: `JavaScript functions should not be mutable but not *that* mutable`
			mixins = Object.assign({}, this.config.javascriptFunctions);
		}

		let promises = [];
		for (let key of keys) {
			promises.push(
				getJavaScriptData(inst, inputPath, key, {
					mixins,
					isObjectRequired: key === "data",
				}),
			);
		}

		let results = await Promise.all(promises);
		let data = {};
		for (let result of results) {
			Object.assign(data, result);
		}
		dataBench.after();

		return data;
	}

	async compile(str, inputPath, ...args) {
		await this._runningInit();
		let defaultCompilationFn;
		if (this._defaultEngine) {
			defaultCompilationFn = async (data) => {
				const renderFn = await this._defaultEngine.compile(str, inputPath, ...args);
				return renderFn(data);
			};
		}

		// Fall back to default compiler if the user does not provide their own
		if (!this.entry.compile) {
			if (defaultCompilationFn) {
				return defaultCompilationFn;
			} else {
				throw new Error(
					`Missing \`compile\` property for custom template syntax definition eleventyConfig.addExtension("${this.name}"). This is not necessary when aliasing to an existing template syntax.`,
				);
			}
		}

		// TODO generalize this (look at JavaScript.js)
		let compiledFn = this.entry.compile.bind({
			config: this.config,
			addDependencies: (from, toArray = []) => {
				this.config.uses.addDependency(from, toArray);
			},
			defaultRenderer: defaultCompilationFn, // bind defaultRenderer to compile function
		})(str, inputPath);

		// Support `undefined` to skip compile/render
		if (compiledFn) {
			// Bind defaultRenderer to render function
			if ("then" in compiledFn && typeof compiledFn.then === "function") {
				// Promise, wait to bind
				return compiledFn.then((fn) => {
					if (typeof fn === "function") {
						return fn.bind({
							defaultRenderer: defaultCompilationFn,
						});
					}
					return fn;
				});
			} else if ("bind" in compiledFn && typeof compiledFn.bind === "function") {
				return compiledFn.bind({
					defaultRenderer: defaultCompilationFn,
				});
			}
		}

		return compiledFn;
	}

	get defaultTemplateFileExtension() {
		return this.entry.outputFileExtension ?? "html";
	}

	// Whether or not to wrap in Eleventy layouts
	useLayouts() {
		// TODO future change fallback to `this.defaultTemplateFileExtension === "html"`
		return this.entry.useLayouts ?? true;
	}

	hasDependencies(inputPath) {
		if (this.config.uses.getDependencies(inputPath) === false) {
			return false;
		}
		return true;
	}

	wasFileRelevantToPreviousBuild(inputPath) {
		return this.previousQueue.find((comparisonFile) =>
			this.config.uses.isFileRelevantTo(inputPath, comparisonFile, false),
		);
	}

	getCompileCacheKey(str, inputPath) {
		// Return this separately so we know whether or not to use the cached version
		// but still return a key to cache this new render for next time
		let useCache = !this.wasFileRelevantToPreviousBuild(inputPath);

		if (this.entry.compileOptions && "getCacheKey" in this.entry.compileOptions) {
			if (typeof this.entry.compileOptions.getCacheKey !== "function") {
				throw new Error(
					`\`compileOptions.getCacheKey\` must be a function in addExtension for the ${this.name} type`,
				);
			}

			return {
				useCache,
				key: this.entry.compileOptions.getCacheKey(str, inputPath),
			};
		}

		let { key } = super.getCompileCacheKey(str, inputPath);
		return {
			useCache,
			key,
		};
	}

	permalinkNeedsCompilation(/*str*/) {
		if (this.entry.compileOptions && "permalink" in this.entry.compileOptions) {
			let p = this.entry.compileOptions.permalink;
			if (p === "raw") {
				return false;
			}

			// permalink: false is aliased to permalink: () => false
			if (p === false) {
				return () => false;
			}

			return this.entry.compileOptions.permalink;
		}

		// Breaking: default changed from `true` to `false` in 3.0.0-alpha.13
		// Note: `false` is the same as "raw" here.
		return false;
	}

	static shouldSpiderJavaScriptDependencies(entry) {
		if (entry.compileOptions && "spiderJavaScriptDependencies" in entry.compileOptions) {
			return entry.compileOptions.spiderJavaScriptDependencies;
		}

		return false;
	}
}
