import { createDebug } from "../Util/DebugLogUtil.js";

const debug = createDebug("TemplateEngineManager");

class TemplateEngineManager {
	#CustomEngine;

	constructor(eleventyConfig) {
		if (!eleventyConfig || eleventyConfig.constructor.name !== "TemplateConfig") {
			throw new Error("Internal error: missing or invalid `config` argument.");
		}
		this.eleventyConfig = eleventyConfig;

		this.engineCache = {};
		this.importCache = {};
	}

	get config() {
		return this.eleventyConfig.getConfig();
	}

	static isAlias(entry) {
		if (entry.aliasKey) {
			return true;
		}

		return entry.key !== entry.extension;
	}

	static isSimpleAlias(entry) {
		if (!this.isAlias(entry)) {
			return false;
		}

		// has keys other than key, extension, and aliasKey
		return (
			Object.keys(entry).some((key) => {
				return key !== "key" && key !== "extension" && key !== "aliasKey";
			}) === false
		);
	}

	get keyToClassNameMap() {
		if (!this._keyToClassNameMap) {
			this._keyToClassNameMap = {
				md: "Markdown",
				html: "Html",
				njk: "Nunjucks",
				liquid: "Liquid",
				"11ty.js": "JavaScript",
			};

			// Custom entries *can* overwrite default entries above
			if ("extensionMap" in this.config) {
				for (let entry of this.config.extensionMap) {
					// either the key does not already exist or it is not a simple alias and is an override: https://v3.11ty.dev/docs/languages/custom/#overriding-an-existing-template-language
					let existingTarget = this._keyToClassNameMap[entry.key];
					let isAlias = TemplateEngineManager.isAlias(entry);

					if (!existingTarget && isAlias) {
						throw new Error(
							`An attempt to alias ${entry.aliasKey} to ${entry.key} was made, but ${entry.key} is not a recognized template syntax.`,
						);
					}

					if (isAlias) {
						// only `key` and `extension`, not `compile` or other options
						if (!TemplateEngineManager.isSimpleAlias(entry)) {
							this._keyToClassNameMap[entry.aliasKey] = "Custom";
						} else {
							this._keyToClassNameMap[entry.aliasKey] = this._keyToClassNameMap[entry.key];
						}
					} else {
						// not an alias, so `key` and `extension` are the same here.
						// *can* override a built-in extension!
						this._keyToClassNameMap[entry.key] = "Custom";
					}
				}
			}
		}

		return this._keyToClassNameMap;
	}

	reset() {
		this.engineCache = {};
	}

	getClassNameFromTemplateKey(key) {
		return this.keyToClassNameMap[key];
	}

	hasEngine(name) {
		return !!this.getClassNameFromTemplateKey(name);
	}

	async getEngineClassByExtension(extension) {
		if (this.config.extensionMapClasses[extension]) {
			return this.config.extensionMapClasses[extension];
		}
		if (this.importCache[extension]) {
			return this.importCache[extension];
		}

		let promise;

		// We include these as raw strings (and not more readable variables) so they’re parsed by a bundler.
		if (extension === "md") {
			promise = import("../Adapters/Engines/Markdown.js").then((mod) => mod.default);
		} else if (extension === "html") {
			promise = import("./Html.js").then((mod) => mod.default);
		} else if (extension === "njk") {
			promise = import("../Adapters/Engines/Nunjucks.js").then((mod) => mod.default);
		} else if (extension === "liquid") {
			promise = import("../Adapters/Engines/Liquid.js").then((mod) => mod.default);
		} else if (extension === "11ty.js") {
			// ~4KB cost, fine to keep
			promise = import("./JavaScript.js").then((mod) => mod.default);
		} else {
			promise = this.getCustomEngineClass();
		}

		if (promise) {
			this.importCache[extension] = promise;
		} else {
			throw new Error("Missing engine for file extension: " + extension);
		}

		return promise;
	}

	async getCustomEngineClass() {
		if (!this.#CustomEngine) {
			this.#CustomEngine = import("./Custom.js").then((mod) => mod.default);
		}
		return this.#CustomEngine;
	}

	async #getEngine(name, extensionMap) {
		let cls = await this.getEngineClassByExtension(name);
		if (!cls) {
			throw new Error(`Missing engine for ${name}. Do you need to use eleventyConfig.addEngine?`);
		}

		let instance = new cls(name, this.eleventyConfig);
		instance.extensionMap = extensionMap;
		instance.engineManager = this;

		let extensionEntry = extensionMap.getExtensionEntry(name);

		// Override a built-in extension (md => md)
		// If provided a "Custom" engine using addExtension, but that engine's instance is *not* custom,
		// The user must be overriding a built-in engine i.e. addExtension('md', { ...overrideBehavior })
		let className = this.getClassNameFromTemplateKey(name);

		if (className === "Custom" && instance.constructor.name !== "CustomEngine") {
			let CustomEngine = await this.getCustomEngineClass();
			let overrideCustomEngine = new CustomEngine(name, this.eleventyConfig);

			// Keep track of the "default" engine 11ty would normally use
			// This allows the user to access the default engine in their override
			overrideCustomEngine.setDefaultEngine(instance);

			instance = overrideCustomEngine;
			// Alias to a built-in extension (11ty.tsx => 11ty.js)
		} else if (
			instance.constructor.name === "CustomEngine" &&
			TemplateEngineManager.isAlias(extensionEntry)
		) {
			// add defaultRenderer for complex aliases with their own compile functions.
			let originalEngineInstance = await this.getEngine(extensionEntry.key, extensionMap);
			instance.setDefaultEngine(originalEngineInstance);
		}

		return instance;
	}

	isEngineRemovedFromCore(name) {
		return ["ejs", "hbs", "mustache", "haml", "pug"].includes(name) && !this.hasEngine(name);
	}

	async getEngine(name, extensionMap) {
		// Bundled engine deprecation
		if (this.isEngineRemovedFromCore(name)) {
			throw new Error(
				`Per the 11ty Community Survey (2023), the "${name}" template language was moved from core to an officially supported plugin in v3.0. These plugins live here: https://github.com/11ty/eleventy-plugin-template-languages and are documented on their respective template language docs at https://v3.11ty.dev/docs/languages/ You are also empowered to implement *any* template language yourself using https://v3.11ty.dev/docs/languages/custom/`,
			);
		}

		if (!this.hasEngine(name)) {
			throw new Error(`Template Engine ${name} does not exist in getEngine()`);
		}
		// TODO these cached engines should be based on extensions not name, then we can remove the error in
		//  "Double override (not aliases) throws an error" test in TemplateRenderCustomTest.js
		if (!this.engineCache[name]) {
			debug("Engine cache miss %o (should only happen once per engine type)", name);
			// Make sure cache key is based on name and not path
			// Custom class is used for all plugins, cache once per plugin
			this.engineCache[name] = this.#getEngine(name, extensionMap);
		}

		return this.engineCache[name];
	}
}

export default TemplateEngineManager;
