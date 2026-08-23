import { Merge, TemplatePath, isPlainObject } from "@11ty/eleventy-utils";

import chalk from "./Adapters/Packages/chalk.js";
import getDefaultConfig from "./Adapters/getDefaultConfig.js";
import { createDebug } from "./Util/DebugLogUtil.js";
import { DynamicImportRaw } from "./Util/Require.js";
import BaseError from "./Errors/BaseError.js";
import UserConfig from "./UserConfig.js";
import GlobalDependencyMap from "./GlobalDependencyMap.js";
import ExistsCache from "./Util/ExistsCache.js";
import eventBus from "./EventBus.js";
import ProjectTemplateFormats from "./Util/ProjectTemplateFormats.js";
import { expandEligibleJavaScriptFilePaths } from "./Util/FilePathUtil.js";

const debug = createDebug("TemplateConfig");

/**
 * @module 11ty/eleventy/TemplateConfig
 */

/**
 * Config as used by the template.
 * @typedef {object} module:11ty/eleventy/TemplateConfig~TemplateConfig~config
 * @property {String} [pathPrefix] - The path prefix.
 */

/**
 * Errors in eleventy config.
 * @ignore
 */
class ConfigError extends BaseError {}

/**
 * Errors in eleventy plugins.
 * @ignore
 */
class PluginError extends BaseError {}

/**
 * Config for a template.
 * @ignore
 * @param {{}} customRootConfig - tbd.
 * @param {String} projectConfigPath - Path to local project config.
 */
class TemplateConfig {
	#templateFormats;
	#runMode;
	#configManuallyDefined = false;
	/** @type {UserConfig} */
	#userConfig = new UserConfig();
	#existsCache = new ExistsCache();
	#usesGraph;
	#activeConfigPath;

	constructor(customRootConfig, projectConfigPath) {
		/** @type {object} */
		this.overrides = {};

		/**
		 * @type {String}
		 * @description Path to local project config.
		 * @default buildawesome.config.js
		 */
		if (projectConfigPath !== undefined) {
			this.#configManuallyDefined = true;

			if (!projectConfigPath) {
				// falsy skips config files
				this.projectConfigPaths = [];
			} else {
				this.projectConfigPaths = [projectConfigPath];
			}
		} else {
			this.projectConfigPaths = [
				...expandEligibleJavaScriptFilePaths("buildawesome.config"),
				".eleventy.js", // intentionally has never included other JS extensions
				...expandEligibleJavaScriptFilePaths("eleventy.config"),
			];
		}

		if (customRootConfig) {
			/**
			 * @type {object}
			 * @description Custom root config.
			 */
			this.customRootConfig = customRootConfig;
			debug("Warning: Using custom root config!");
		} else {
			this.customRootConfig = null;
		}

		this.hasConfigMerged = false;
		this.isEsm = false;

		// Wire up exists API to user config
		this.userConfig.exists = (filePath) => {
			return this.existsCache.exists(filePath);
		};

		this.userConfig.events.on("buildawesome#templatemodified", (inputPath, metadata = {}) => {
			// Issue #3569, set that this file exists in the cache
			this.#existsCache.set(inputPath, true);
		});
	}

	get userConfig() {
		return this.#userConfig;
	}

	get aggregateBenchmark() {
		return this.userConfig.benchmarks.aggregate;
	}

	/* Setter for Logger */
	setLogger(logger) {
		this.logger = logger;
		this.userConfig.logger = this.logger;
	}

	/* Setter for Directories instance */
	setDirectories(directories) {
		this.directories = directories;
		this.userConfig.directories = directories.getUserspaceInstance();
	}

	/* Setter for TemplateFormats instance */
	setTemplateFormats(templateFormats) {
		this.#templateFormats = templateFormats;
	}

	get templateFormats() {
		if (!this.#templateFormats) {
			this.#templateFormats = new ProjectTemplateFormats();
		}
		return this.#templateFormats;
	}

	/* Backwards compat */
	get inputDir() {
		return this.directories.input;
	}

	setRunMode(runMode) {
		this.#runMode = runMode;
	}

	shouldSpiderJavaScriptDependencies() {
		// not for a standard build
		return (
			(this.#runMode === "watch" || this.#runMode === "serve") &&
			this.userConfig.watchJavaScriptDependencies
		);
	}

	/**
	 * Normalises local project config file path.
	 *
	 * @method
	 * @returns {String|undefined} - The normalised local project config file path.
	 */
	getLocalProjectConfigFile() {
		let configFiles = this.getLocalProjectConfigFiles();
		let configFile = configFiles.find((path) => path && this.existsCache.exists(path));
		if (configFile) {
			return configFile;
		}
	}

	getLocalProjectConfigFiles() {
		let paths = this.projectConfigPaths;
		if (paths?.length > 0) {
			return TemplatePath.addLeadingDotSlashArray(paths.filter((path) => Boolean(path)));
		}
		return [];
	}

	getActiveConfigPath() {
		if (!this.#activeConfigPath) {
			this.#activeConfigPath = this.getLocalProjectConfigFile();
		}
		return this.#activeConfigPath;
	}

	setProjectUsingEsm(isEsmProject) {
		this.isEsm = !!isEsmProject;
		this.usesGraph.setIsEsm(isEsmProject);
	}

	getIsProjectUsingEsm() {
		return this.isEsm;
	}

	/**
	 * Resets the configuration.
	 */
	async reset() {
		this.#existsCache.reset();
		this.userConfig.reset();
		this.usesGraph.reset(); // needs to be before forceReloadConfig #3711

		// await this.initializeRootConfig();
		await this.forceReloadConfig();

		// Clear the compile cache
		eventBus.emit("buildawesome.compilecachereset");
	}

	/**
	 * Resets the configuration while in watch mode.
	 *
	 * @todo Add implementation.
	 */
	resetOnWatch() {
		// nothing yet
	}

	hasInitialized() {
		return this.hasConfigMerged;
	}

	/**
	 * Async-friendly init method
	 */
	async init(overrides) {
		this.#activeConfigPath = undefined; // reset

		await this.initializeRootConfig();

		if (overrides) {
			this.appendToRootConfig(overrides);
		}

		this.config = await this.mergeConfig();
		this.hasConfigMerged = true;
	}

	/**
	 * Force a reload of the configuration object.
	 */
	async forceReloadConfig() {
		this.hasConfigMerged = false;
		await this.init();
	}

	/**
	 * Returns the config object.
	 *
	 * @returns {{}} - The config object.
	 */
	getConfig() {
		if (!this.hasConfigMerged) {
			throw new Error("Invalid call to .getConfig(). Needs an .init() first.");
		}

		return this.config;
	}

	/**
	 * Overwrites the config path.
	 *
	 * @param {String} path - The new config path.
	 */
	async setProjectConfigPath(path) {
		this.#configManuallyDefined = true;

		if (path !== undefined) {
			this.projectConfigPaths = [path];
		} else {
			this.projectConfigPaths = [];
		}

		if (this.hasConfigMerged) {
			// merge it again
			await this.forceReloadConfig();
		}
	}

	/**
	 * Overwrites the path prefix.
	 *
	 * @param {String} pathPrefix - The new path prefix.
	 */
	setPathPrefix(pathPrefix) {
		if (pathPrefix && pathPrefix !== "/") {
			debug("Setting pathPrefix to %o", pathPrefix);
			this.overrides.pathPrefix = pathPrefix;
		}
	}

	/**
	 * Gets the current path prefix denoting the root folder the output will be deployed to
	 *
	 *  @returns {String} - The path prefix string
	 */
	getPathPrefix() {
		if (this.overrides.pathPrefix) {
			return this.overrides.pathPrefix;
		}

		if (!this.hasConfigMerged) {
			throw new Error("Config has not yet merged. Needs `init()`.");
		}

		return this.config?.pathPrefix;
	}

	/**
	 * Bootstraps the config object.
	 */
	async initializeRootConfig() {
		this.rootConfig = this.customRootConfig;
		if (!this.rootConfig) {
			this.rootConfig = await getDefaultConfig();
		}

		if (typeof this.rootConfig === "function") {
			// Not yet using async in defaultConfig.js
			this.rootConfig = this.rootConfig.call(this, this.userConfig);
		}

		debug("Default Eleventy config %o", this.rootConfig);
	}

	/*
	 * Add additional overrides to the root config object, used for testing
	 *
	 * @param {object} - a subset of the return Object from the user’s config file.
	 */
	appendToRootConfig(obj) {
		Object.assign(this.rootConfig, obj);
	}

	/*
	 * Process the userland plugins from the Config
	 *
	 * @param {object} - the return Object from the user’s config file.
	 */
	async processPlugins({ dir, pathPrefix }) {
		this.userConfig.dir = dir;
		this.userConfig.pathPrefix = pathPrefix;

		// for Nested addPlugin calls, Issue #1925
		this.userConfig._enablePluginExecution();

		let storedActiveNamespace = this.userConfig.activeNamespace;
		for (let { plugin, options, pluginNamespace } of this.userConfig.plugins) {
			try {
				this.userConfig.activeNamespace = pluginNamespace;
				await this.userConfig._executePlugin(plugin, options);
			} catch (e) {
				let name = this.userConfig._getPluginName(plugin);
				let namespaces = [storedActiveNamespace, pluginNamespace].filter((entry) => !!entry);

				let namespaceStr = "";
				if (namespaces.length) {
					namespaceStr = ` (namespace: ${namespaces.join(".")})`;
				}

				throw new PluginError(
					`Error processing ${name ? `the \`${name}\`` : "a"} plugin${namespaceStr}`,
					e,
				);
			}
		}

		this.userConfig.activeNamespace = storedActiveNamespace;

		this.userConfig._disablePluginExecution();
	}

	/**
	 * Fetches and executes the local configuration file
	 *
	 * @returns {Promise<object>} merged - The merged config file object.
	 */
	async requireLocalConfigFile() {
		let localConfig = {};
		let exportedConfig = {};

		let path = this.getActiveConfigPath();

		if (this.projectConfigPaths.length > 0 && this.#configManuallyDefined && !path) {
			throw new ConfigError(
				"A configuration file was specified but not found: " + this.projectConfigPaths.join(", "),
			);
		}

		debug(`Merging default config with ${path}`);
		if (path) {
			try {
				let { default: configDefaultReturn, config: exportedConfigObject } = await DynamicImportRaw(
					path,
					this.isEsm ? "esm" : "cjs",
				);

				exportedConfig = exportedConfigObject || {};

				if (this.directories && Object.keys(exportedConfigObject?.dir || {}).length > 0) {
					debug(
						"Setting directories via `config.dir` export from config file: %o",
						exportedConfigObject.dir,
					);
					this.directories.setViaConfigObject(exportedConfigObject.dir);
				}

				if (typeof configDefaultReturn === "function") {
					localConfig = await configDefaultReturn(this.userConfig);
				} else {
					localConfig = configDefaultReturn;
				}

				// Removed a check for `filters` in 3.0.0-alpha.6 (now using addTransform instead) https://v3.11ty.dev/docs/config/#transforms
			} catch (err) {
				let isModuleError =
					err instanceof Error && (err?.message || "").includes("Cannot find module");

				// TODO the error message here is bad and I feel bad (needs more accurate info)
				return Promise.reject(
					new ConfigError(
						`Error in your Eleventy config file '${path}'.` +
							(isModuleError ? chalk.cyan(" You may need to run `npm install`.") : ""),
						err,
					),
				);
			}
		} else {
			debug(
				"Project config file not found (not an error—skipping). Looked in: %o",
				this.projectConfigPaths,
			);
		}

		return {
			localConfig,
			exportedConfig,
		};
	}

	/**
	 * Merges different config files together.
	 *
	 * @returns {Promise<object>} merged - The merged config file.
	 */
	async mergeConfig() {
		let { localConfig, exportedConfig } = await this.requireLocalConfigFile();

		// Merge `export const config = {}` with `return {}` in config callback
		if (isPlainObject(exportedConfig)) {
			localConfig = Merge(localConfig || {}, exportedConfig);
		}

		if (this.directories) {
			if (Object.keys(this.userConfig.directoryAssignments || {}).length > 0) {
				debug(
					"Setting directories via set*Directory configuration APIs %o",
					this.userConfig.directoryAssignments,
				);
				this.directories.setViaConfigObject(this.userConfig.directoryAssignments);
			}

			if (localConfig && Object.keys(localConfig?.dir || {}).length > 0) {
				debug(
					"Setting directories via `dir` object return from configuration file: %o",
					localConfig.dir,
				);
				this.directories.setViaConfigObject(localConfig.dir);
			}
		}

		// `templateFormats` is an override via `setTemplateFormats`
		if (this.userConfig?.templateFormats) {
			this.templateFormats.setViaConfig(this.userConfig.templateFormats);
		} else if (localConfig?.templateFormats || this.rootConfig?.templateFormats) {
			// Local project config or defaultConfig.js
			this.templateFormats.setViaConfig(
				localConfig.templateFormats || this.rootConfig?.templateFormats,
			);
		}

		// `templateFormatsAdded` is additive via `addTemplateFormats`
		if (this.userConfig?.templateFormatsAdded) {
			this.templateFormats.addViaConfig(this.userConfig.templateFormatsAdded);
		}

		// prefer Configuration API methods over return object
		if (this.userConfig?.htmlTemplateEngine !== undefined) {
			localConfig.htmlTemplateEngine = this.userConfig?.htmlTemplateEngine;
		}

		// prefer Configuration API methods over return object
		if (this.userConfig?.markdownTemplateEngine !== undefined) {
			localConfig.markdownTemplateEngine = this.userConfig?.markdownTemplateEngine;
		}

		let mergedConfig = Merge({}, this.rootConfig, localConfig);

		// Setup a few properties for plugins:

		// Set frozen templateFormats
		mergedConfig.templateFormats = Object.freeze(this.templateFormats.getTemplateFormats());

		// Setup pathPrefix set via command line for plugin consumption
		if (this.overrides.pathPrefix) {
			mergedConfig.pathPrefix = this.overrides.pathPrefix;
		}

		// Returning a falsy value (e.g. "") from user config should reset to the default value.
		if (!mergedConfig.pathPrefix) {
			mergedConfig.pathPrefix = this.rootConfig.pathPrefix;
		}

		// This is not set in UserConfig.js so that getters aren’t converted to strings
		// We want to error if someone attempts to use a setter there.
		if (this.directories) {
			mergedConfig.directories = this.directories.getUserspaceInstance();
		}

		// Delay processing plugins until after the result of localConfig is returned
		// But BEFORE the rest of the config options are merged
		// this way we can pass directories and other template information to plugins

		await this.userConfig.events.emit("buildawesome.beforeconfig", this.userConfig);

		let pluginsBench = this.aggregateBenchmark.get("Processing plugins in config");
		pluginsBench.before();
		await this.processPlugins(mergedConfig);
		pluginsBench.after();

		// Template formats added via plugins
		if (this.userConfig?.templateFormatsAdded) {
			this.templateFormats.addViaConfig(this.userConfig.templateFormatsAdded);
			mergedConfig.templateFormats = Object.freeze(this.templateFormats.getTemplateFormats());
		}

		let eleventyConfigApiMergingObject = this.userConfig.getMergingConfigObject();

		if ("templateFormats" in eleventyConfigApiMergingObject) {
			throw new Error(
				"Internal error: templateFormats should not return from `getMergingConfigObject`",
			);
		}

		// Overrides are only used by pathPrefix
		debug("Configuration overrides: %o", this.overrides);
		Merge(mergedConfig, eleventyConfigApiMergingObject, this.overrides);

		debug("Current configuration: %o", mergedConfig);

		// Add to the merged config too
		mergedConfig.uses = this.usesGraph;

		return mergedConfig;
	}

	/**
	 * @type {GlobalDependencyMap}
	 */
	get usesGraph() {
		if (!this.#usesGraph) {
			this.#usesGraph = new GlobalDependencyMap();
			this.#usesGraph.setIsEsm(this.isEsm);
			this.#usesGraph.setTemplateConfig(this);
		}
		return this.#usesGraph;
	}

	/**
	 * @type {GlobalDependencyMap}
	 */
	get uses() {
		if (!this.usesGraph) {
			throw new Error("The Eleventy Global Dependency Graph has not yet been initialized.");
		}
		return this.usesGraph;
	}

	/**
	 * @type {ExistsCache}
	 */
	get existsCache() {
		return this.#existsCache;
	}
}

export default TemplateConfig;
