import chalk from "kleur";
import { performance } from "node:perf_hooks";
import debugUtil from "debug";
import { filesize } from "filesize";
import path from "node:path";

/* Eleventy Deps */
import { TemplatePath } from "@11ty/eleventy-utils";
import BundlePlugin from "@11ty/eleventy-plugin-bundle";

import TemplateData from "./Data/TemplateData.js";
import TemplateWriter from "./TemplateWriter.js";
import EleventyExtensionMap from "./EleventyExtensionMap.js";
import { EleventyErrorHandler } from "./Errors/EleventyErrorHandler.js";
import EleventyBaseError from "./Errors/EleventyBaseError.js";
import EleventyServe from "./EleventyServe.js";
import EleventyWatch from "./EleventyWatch.js";
import EleventyWatchTargets from "./EleventyWatchTargets.js";
import EleventyFiles from "./EleventyFiles.js";
import TemplatePassthroughManager from "./TemplatePassthroughManager.js";
import TemplateConfig from "./TemplateConfig.js";
import FileSystemSearch from "./FileSystemSearch.js";
import TemplateEngineManager from "./Engines/TemplateEngineManager.js";

/* Utils */
import ConsoleLogger from "./Util/ConsoleLogger.js";
import PathPrefixer from "./Util/PathPrefixer.js";
import ProjectDirectories from "./Util/ProjectDirectories.js";
import PathNormalizer from "./Util/PathNormalizer.js";
import { isGlobMatch } from "./Util/GlobMatcher.js";
import simplePlural from "./Util/Pluralize.js";
import checkPassthroughCopyBehavior from "./Util/PassthroughCopyBehaviorCheck.js";
import eventBus from "./EventBus.js";
import {
	getEleventyPackageJson,
	importJsonSync,
	getWorkingProjectPackageJsonPath,
} from "./Util/ImportJsonSync.js";
import { EleventyImport } from "./Util/Require.js";
import ProjectTemplateFormats from "./Util/ProjectTemplateFormats.js";
import { withResolvers } from "./Util/PromiseUtil.js";

/* Plugins */
import RenderPlugin, * as RenderPluginExtras from "./Plugins/RenderPlugin.js";
import I18nPlugin, * as I18nPluginExtras from "./Plugins/I18nPlugin.js";
import HtmlBasePlugin, * as HtmlBasePluginExtras from "./Plugins/HtmlBasePlugin.js";
import { TransformPlugin as InputPathToUrlTransformPlugin } from "./Plugins/InputPathToUrl.js";
import { IdAttributePlugin } from "./Plugins/IdAttributePlugin.js";
import FileSystemRemap from "./Util/GlobRemap.js";

const pkg = getEleventyPackageJson();
const debug = debugUtil("Eleventy");

/**
 * Eleventy’s programmatic API
 * @module 11ty/eleventy/Eleventy
 */

class Eleventy {
	/**
	 * Userspace package.json file contents
	 * @type {object|undefined}
	 */
	#projectPackageJson;
	/** @type {string} */
	#projectPackageJsonPath;
	/** @type {ProjectTemplateFormats|undefined} */
	#templateFormats;
	/** @type {ConsoleLogger|undefined} */
	#logger;
	/** @type {ProjectDirectories|undefined} */
	#directories;
	/** @type {boolean|undefined} */
	#verboseOverride;
	/** @type {boolean} */
	#isVerboseMode = true;
	/** @type {boolean|undefined} */
	#preInitVerbose;
	/** @type {boolean} */
	#hasConfigInitialized = false;
	/** @type {boolean} */
	#needsInit = true;
	/** @type {Promise|undefined} */
	#initPromise;
	/** @type {EleventyErrorHandler|undefined} */
	#errorHandler;
	/** @type {Map} */
	#privateCaches = new Map();
	/** @type {boolean} */
	#isStopping = false;
	/** @type {boolean|undefined} */
	#isEsm;

	/**
	 * @typedef {object} EleventyOptions
	 * @property {'cli'|'script'=} source
	 * @property {'build'|'serve'|'watch'=} runMode
	 * @property {boolean=} dryRun
	 * @property {string=} configPath
	 * @property {string=} pathPrefix
	 * @property {boolean=} quietMode
	 * @property {Function=} config
	 * @property {string=} inputDir

	 * @param {string} [input] - Directory or filename for input/sources files.
	 * @param {string} [output] - Directory serving as the target for writing the output files.
	 * @param {EleventyOptions} [options={}]
	 * @param {TemplateConfig} [eleventyConfig]
	 */
	constructor(input, output, options = {}, eleventyConfig = null) {
		/**
		 * @type {string|undefined}
		 * @description Holds the path to the input (might be a file or folder)
		 */
		this.rawInput = input || undefined;

		/**
		 * @type {string|undefined}
		 * @description holds the path to the output directory
		 */
		this.rawOutput = output || undefined;

		/**
		 * @type {module:11ty/eleventy/TemplateConfig}
		 * @description Override the config instance (for centralized config re-use)
		 */
		this.eleventyConfig = eleventyConfig;

		/**
		 * @type {EleventyOptions}
		 * @description Options object passed to the Eleventy constructor
		 * @default {}
		 */
		this.options = options;

		/**
		 * @type {'cli'|'script'}
		 * @description Called via CLI (`cli`) or Programmatically (`script`)
		 * @default "script"
		 */
		this.source = options.source || "script";

		/**
		 * @type {string}
		 * @description One of build, serve, or watch
		 * @default "build"
		 */
		this.runMode = options.runMode || "build";

		/**
		 * @type {boolean}
		 * @description Is Eleventy running in dry mode?
		 * @default false
		 */
		this.isDryRun = options.dryRun ?? false;

		/**
		 * @type {boolean}
		 * @description Is this an incremental build? (only operates on a subset of input files)
		 * @default false
		 */
		this.isIncremental = false;

		/**
		 * @type {string|undefined}
		 * @description If an incremental build, this is the file we’re operating on.
		 * @default null
		 */
		this.programmaticApiIncrementalFile = undefined;

		/**
		 * @type {boolean}
		 * @description Should we process files on first run? (The --ignore-initial feature)
		 * @default true
		 */
		this.isRunInitialBuild = true;

		/**
		 * @type {Number}
		 * @description Number of builds run on this instance.
		 * @default 0
		 */
		this.buildCount = 0;

		/**
		 * @member {String} - Force ESM or CJS mode instead of detecting from package.json. Either cjs, esm, or auto.
		 * @default "auto"
		 */
		this.loader = this.options.loader ?? "auto";

		/**
		 * @type {Number}
		 * @description The timestamp of Eleventy start.
		 */
		this.start = this.getNewTimestamp();
	}

	/**
	 * @type {string|undefined}
	 * @description An override of Eleventy's default config file paths
	 * @default undefined
	 */
	get configPath() {
		return this.options.configPath;
	}

	/**
	 * @type {string}
	 * @description The top level directory the site pretends to reside in
	 * @default "/"
	 */
	get pathPrefix() {
		return this.options.pathPrefix || "/";
	}

	async initializeConfig(initOverrides) {
		if (!this.eleventyConfig) {
			this.eleventyConfig = new TemplateConfig(null, this.configPath);
		} else if (this.configPath) {
			await this.eleventyConfig.setProjectConfigPath(this.configPath);
		}

		this.eleventyConfig.setRunMode(this.runMode);
		this.eleventyConfig.setProjectUsingEsm(this.isEsm);
		this.eleventyConfig.setLogger(this.logger);
		this.eleventyConfig.setDirectories(this.directories);
		this.eleventyConfig.setTemplateFormats(this.templateFormats);

		if (this.pathPrefix || this.pathPrefix === "") {
			this.eleventyConfig.setPathPrefix(this.pathPrefix);
		}

		// Debug mode should always run quiet (all output goes to debug logger)
		if (process.env.DEBUG) {
			this.#verboseOverride = false;
		} else if (this.options.quietMode === true || this.options.quietMode === false) {
			this.#verboseOverride = !this.options.quietMode;
		}

		// Moved before config merges: https://github.com/11ty/eleventy/issues/3316
		if (this.#verboseOverride === true || this.#verboseOverride === false) {
			this.eleventyConfig.userConfig._setQuietModeOverride(!this.#verboseOverride);
		}

		this.eleventyConfig.userConfig.directories = this.directories;

		/* Programmatic API config */
		if (this.options.config && typeof this.options.config === "function") {
			debug("Running options.config configuration callback (passed to Eleventy constructor)");
			// TODO use return object here?
			await this.options.config(this.eleventyConfig.userConfig);
		}

		/**
		 * @type {object}
		 * @description Initialize Eleventy environment variables
		 * @default null
		 */
		// this.runMode need to be set before this
		this.env = this.getEnvironmentVariableValues();
		this.initializeEnvironmentVariables(this.env);

		// Async initialization of configuration
		await this.eleventyConfig.init(initOverrides);

		/**
		 * @type {object}
		 * @description Initialize Eleventy’s configuration, including the user config file
		 */
		this.config = this.eleventyConfig.getConfig();

		/**
		 * @type {object}
		 * @description Singleton BenchmarkManager instance
		 */
		this.bench = this.config.benchmarkManager;

		if (performance) {
			debug("Eleventy warm up time: %o (ms)", performance.now());
		}

		// Careful to make sure the previous server closes on SIGINT, issue #3873
		if (!this.eleventyServe) {
			/** @type {object} */
			this.eleventyServe = new EleventyServe();
		}
		this.eleventyServe.eleventyConfig = this.eleventyConfig;

		/** @type {object} */
		this.watchManager = new EleventyWatch();

		/** @type {object} */
		this.watchTargets = new EleventyWatchTargets(this.eleventyConfig);
		this.watchTargets.addAndMakeGlob(this.config.additionalWatchTargets);

		/** @type {object} */
		this.fileSystemSearch = new FileSystemSearch();

		this.#hasConfigInitialized = true;

		// after #hasConfigInitialized above
		this.setIsVerbose(this.#preInitVerbose ?? !this.config.quietMode);
	}

	getNewTimestamp() {
		if (performance) {
			return performance.now();
		}
		return new Date().getTime();
	}

	/** @type {ProjectDirectories} */
	get directories() {
		if (!this.#directories) {
			this.#directories = new ProjectDirectories();
			this.#directories.setInput(this.rawInput, this.options.inputDir);
			this.#directories.setOutput(this.rawOutput);

			if (this.source == "cli" && (this.rawInput !== undefined || this.rawOutput !== undefined)) {
				this.#directories.freeze();
			}
		}

		return this.#directories;
	}

	/** @type {string} */
	get input() {
		return this.directories.inputFile || this.directories.input || this.config.dir.input;
	}

	/** @type {string} */
	get inputFile() {
		return this.directories.inputFile;
	}

	/** @type {string} */
	get inputDir() {
		return this.directories.input;
	}

	// Not used internally, removed in 3.0.
	setInputDir() {
		throw new Error(
			"Eleventy->setInputDir was removed in 3.0. Use the inputDir option to the constructor",
		);
	}

	/** @type {string} */
	get outputDir() {
		return this.directories.output || this.config.dir.output;
	}

	/**
	 * Updates the dry-run mode of Eleventy.
	 *
	 * @param {boolean} isDryRun - Shall Eleventy run in dry mode?
	 */
	setDryRun(isDryRun) {
		this.isDryRun = !!isDryRun;
	}

	/**
	 * Sets the incremental build mode.
	 *
	 * @param {boolean} isIncremental - Shall Eleventy run in incremental build mode and only write the files that trigger watch updates
	 */
	setIncrementalBuild(isIncremental) {
		this.isIncremental = !!isIncremental;

		if (this.watchManager) {
			this.watchManager.incremental = !!isIncremental;
		}
		if (this.writer) {
			this.writer.setIncrementalBuild(this.isIncremental);
		}
	}

	/**
	 * Set whether or not to do an initial build
	 *
	 * @param {boolean} ignoreInitialBuild - Shall Eleventy ignore the default initial build before watching in watch/serve mode?
	 * @default true
	 */
	setIgnoreInitial(ignoreInitialBuild) {
		this.isRunInitialBuild = !ignoreInitialBuild;

		if (this.writer) {
			this.writer.setRunInitialBuild(this.isRunInitialBuild);
		}
	}

	/**
	 * Updates the path prefix used in the config.
	 *
	 * @param {string} pathPrefix - The new path prefix.
	 */
	setPathPrefix(pathPrefix) {
		if (pathPrefix || pathPrefix === "") {
			this.eleventyConfig.setPathPrefix(pathPrefix);
			// TODO reset config
			// this.config = this.eleventyConfig.getConfig();
		}
	}

	/**
	 * Restarts Eleventy.
	 */
	async restart() {
		debug("Restarting.");
		this.start = this.getNewTimestamp();

		this.extensionMap.reset();
		this.bench.reset();
		this.passthroughManager.reset();
		this.eleventyFiles.restart();
	}

	/**
	 * Logs some statistics after a complete run of Eleventy.
	 *
	 * @returns {string} ret - The log message.
	 */
	logFinished() {
		if (!this.writer) {
			throw new Error(
				"Did you call Eleventy.init to create the TemplateWriter instance? Hint: you probably didn’t.",
			);
		}

		let ret = [];

		let {
			copyCount,
			copySize,
			skipCount,
			writeCount,
			// renderCount, // files that render (costly) but may not write to disk
		} = this.writer.getMetadata();

		let slashRet = [];

		if (copyCount) {
			debug("Total passthrough copy aggregate size: %o", filesize(copySize));
			slashRet.push(`Copied ${chalk.bold(copyCount)}`);
		}

		slashRet.push(
			`Wrote ${chalk.bold(writeCount)} ${simplePlural(writeCount, "file", "files")}${
				skipCount ? ` (skipped ${skipCount})` : ""
			}`,
		);

		// slashRet.push(
		// 	`${renderCount} rendered`
		// )

		if (slashRet.length) {
			ret.push(slashRet.join(" "));
		}

		let time = (this.getNewTimestamp() - this.start) / 1000;
		ret.push(
			`in ${chalk.bold(time.toFixed(2))} ${simplePlural(time.toFixed(2), "second", "seconds")}`,
		);

		// More than 1 second total, show estimate of per-template time
		if (time >= 1 && writeCount > 1) {
			ret.push(`(${((time * 1000) / writeCount).toFixed(1)}ms each, v${pkg.version})`);
		} else {
			ret.push(`(v${pkg.version})`);
		}

		return ret.join(" ");
	}

	#cache(key, inst) {
		if (!("caches" in inst)) {
			throw new Error("To use #cache you need a `caches` getter object");
		}

		// Restore from cache
		if (this.#privateCaches.has(key)) {
			let c = this.#privateCaches.get(key);
			for (let cacheKey in c) {
				inst[cacheKey] = c[cacheKey];
			}
		} else {
			// Set cache
			let c = {};
			for (let cacheKey of inst.caches || []) {
				c[cacheKey] = inst[cacheKey];
			}
			this.#privateCaches.set(key, c);
		}
	}

	/**
	 * Starts Eleventy.
	 */
	async init(options = {}) {
		let { viaConfigReset } = Object.assign({ viaConfigReset: false }, options);
		if (!this.#hasConfigInitialized) {
			await this.initializeConfig();
		} else {
			// Note: Global event bus is different from user config event bus
			this.config.events.reset();
		}

		await this.config.events.emit("eleventy.config", this.eleventyConfig);

		if (this.env) {
			await this.config.events.emit("eleventy.env", this.env);
		}

		let formats = this.templateFormats.getTemplateFormats();
		let engineManager = new TemplateEngineManager(this.eleventyConfig);
		this.extensionMap = new EleventyExtensionMap(this.eleventyConfig);
		this.extensionMap.setFormats(formats);
		this.extensionMap.engineManager = engineManager;
		await this.config.events.emit("eleventy.extensionmap", this.extensionMap);

		// eleventyServe is always available, even when not in --serve mode
		// TODO directorynorm
		this.eleventyServe.setOutputDir(this.outputDir);

		// TODO
		// this.eleventyServe.setWatcherOptions(this.getChokidarConfig());

		this.templateData = new TemplateData(this.eleventyConfig);
		this.templateData.setProjectUsingEsm(this.isEsm);
		this.templateData.extensionMap = this.extensionMap;
		if (this.env) {
			this.templateData.environmentVariables = this.env;
		}
		this.templateData.setFileSystemSearch(this.fileSystemSearch);

		this.passthroughManager = new TemplatePassthroughManager(this.eleventyConfig);
		this.passthroughManager.setRunMode(this.runMode);
		this.passthroughManager.setDryRun(this.isDryRun);
		this.passthroughManager.extensionMap = this.extensionMap;
		this.passthroughManager.setFileSystemSearch(this.fileSystemSearch);

		this.eleventyFiles = new EleventyFiles(formats, this.eleventyConfig);
		this.eleventyFiles.setPassthroughManager(this.passthroughManager);
		this.eleventyFiles.setFileSystemSearch(this.fileSystemSearch);
		this.eleventyFiles.setRunMode(this.runMode);
		this.eleventyFiles.extensionMap = this.extensionMap;
		// This needs to be set before init or it’ll construct a new one
		this.eleventyFiles.templateData = this.templateData;
		this.eleventyFiles.init();

		if (checkPassthroughCopyBehavior(this.config, this.runMode)) {
			this.eleventyServe.watchPassthroughCopy(
				this.eleventyFiles.getGlobWatcherFilesForPassthroughCopy(),
			);
		}

		// Note these directories are all project root relative
		this.config.events.emit("eleventy.directories", this.directories.getUserspaceInstance());

		this.writer = new TemplateWriter(formats, this.templateData, this.eleventyConfig);

		if (!viaConfigReset) {
			// set or restore cache
			this.#cache("TemplateWriter", this.writer);
		}

		this.writer.logger = this.logger;
		this.writer.extensionMap = this.extensionMap;
		this.writer.setEleventyFiles(this.eleventyFiles);
		this.writer.setPassthroughManager(this.passthroughManager);
		this.writer.setRunInitialBuild(this.isRunInitialBuild);
		this.writer.setIncrementalBuild(this.isIncremental);

		let debugStr = `Directories:
  Input:
    Directory: ${this.directories.input}
    File: ${this.directories.inputFile || false}
    Glob: ${this.directories.inputGlob || false}
  Data: ${this.directories.data}
  Includes: ${this.directories.includes}
  Layouts: ${this.directories.layouts || false}
  Output: ${this.directories.output}
Template Formats: ${formats.join(",")}
Verbose Output: ${this.verboseMode}`;
		debug(debugStr);

		this.writer.setVerboseOutput(this.verboseMode);
		this.writer.setDryRun(this.isDryRun);

		this.#needsInit = false;
	}

	// These are all set as initial global data under eleventy.env.* (see TemplateData->environmentVariables)
	getEnvironmentVariableValues() {
		let values = {
			source: this.source,
			runMode: this.runMode,
		};

		let configPath = this.eleventyConfig.getLocalProjectConfigFile();
		if (configPath) {
			values.config = TemplatePath.absolutePath(configPath);
		}

		// Fixed: instead of configuration directory, explicit root or working directory
		values.root = TemplatePath.getWorkingDir();

		values.source = this.source;

		// Backwards compatibility
		Object.defineProperty(values, "isServerless", {
			enumerable: false,
			value: false,
		});

		return values;
	}

	/**
	 * Set process.ENV variables for use in Eleventy projects
	 *
	 * @method
	 */
	initializeEnvironmentVariables(env) {
		// Recognize that global data `eleventy.version` is coerced to remove prerelease tags
		// and this is the raw version (3.0.0 versus 3.0.0-alpha.6).
		// `eleventy.env.version` does not yet exist (unnecessary)
		process.env.ELEVENTY_VERSION = Eleventy.getVersion();

		process.env.ELEVENTY_ROOT = env.root;
		debug("Setting process.env.ELEVENTY_ROOT: %o", env.root);

		process.env.ELEVENTY_SOURCE = env.source;
		process.env.ELEVENTY_RUN_MODE = env.runMode;
	}

	/** @param {boolean} value */
	set verboseMode(value) {
		this.setIsVerbose(value);
	}

	/** @type {boolean} */
	get verboseMode() {
		return this.#isVerboseMode;
	}

	/** @type {ConsoleLogger} */
	get logger() {
		if (!this.#logger) {
			this.#logger = new ConsoleLogger();
			this.#logger.isVerbose = this.verboseMode;
		}

		return this.#logger;
	}

	/** @param {ConsoleLogger} logger */
	set logger(logger) {
		this.eleventyConfig.setLogger(logger);
		this.#logger = logger;
	}

	disableLogger() {
		this.logger.overrideLogger(false);
	}

	/** @type {EleventyErrorHandler} */
	get errorHandler() {
		if (!this.#errorHandler) {
			this.#errorHandler = new EleventyErrorHandler();
			this.#errorHandler.isVerbose = this.verboseMode;
			this.#errorHandler.logger = this.logger;
		}

		return this.#errorHandler;
	}

	/**
	 * Updates the verbose mode of Eleventy.
	 *
	 * @method
	 * @param {boolean} isVerbose - Shall Eleventy run in verbose mode?
	 */
	setIsVerbose(isVerbose) {
		if (!this.#hasConfigInitialized) {
			this.#preInitVerbose = !!isVerbose;
			return;
		}

		// always defer to --quiet if override happened
		isVerbose = this.#verboseOverride ?? !!isVerbose;

		this.#isVerboseMode = isVerbose;

		if (this.logger) {
			this.logger.isVerbose = isVerbose;
		}

		this.bench.setVerboseOutput(isVerbose);

		if (this.writer) {
			this.writer.setVerboseOutput(isVerbose);
		}

		if (this.errorHandler) {
			this.errorHandler.isVerbose = isVerbose;
		}

		// Set verbose mode in config file
		this.eleventyConfig.verbose = isVerbose;
	}

	get templateFormats() {
		if (!this.#templateFormats) {
			let tf = new ProjectTemplateFormats();
			this.#templateFormats = tf;
		}

		return this.#templateFormats;
	}

	/**
	 * Updates the template formats of Eleventy.
	 *
	 * @method
	 * @param {string} formats - The new template formats.
	 */
	setFormats(formats) {
		this.templateFormats.setViaCommandLine(formats);
	}

	/**
	 * Updates the run mode of Eleventy.
	 *
	 * @method
	 * @param {string} runMode - One of "build", "watch", or "serve"
	 */
	setRunMode(runMode) {
		this.runMode = runMode;
	}

	/**
	 * Set the file that needs to be rendered/compiled/written for an incremental build.
	 * This method is also wired up to the CLI --incremental=incrementalFile
	 *
	 * @method
	 * @param {string} incrementalFile - File path (added or modified in a project)
	 */
	setIncrementalFile(incrementalFile) {
		if (incrementalFile) {
			// This used to also setIgnoreInitial(true) but was changed in 3.0.0-alpha.14
			this.setIncrementalBuild(true);

			this.programmaticApiIncrementalFile = TemplatePath.addLeadingDotSlash(incrementalFile);

			this.eleventyConfig.setPreviousBuildModifiedFile(incrementalFile);
		}
	}

	unsetIncrementalFile() {
		// only applies to initial build, no re-runs (--watch/--serve)
		if (this.programmaticApiIncrementalFile) {
			// this.setIgnoreInitial(false);
			this.programmaticApiIncrementalFile = undefined;
		}

		// reset back to false
		this.setIgnoreInitial(false);
	}

	/**
	 * Reads the version of Eleventy.
	 *
	 * @static
	 * @returns {string} - The version of Eleventy.
	 */
	static getVersion() {
		return pkg.version;
	}

	/**
	 * @deprecated since 1.0.1, use static Eleventy.getVersion()
	 */
	getVersion() {
		return Eleventy.getVersion();
	}

	/**
	 * Shows a help message including usage.
	 *
	 * @static
	 * @returns {string} - The help message.
	 */
	static getHelp() {
		return `Usage: eleventy
       eleventy --input=. --output=./_site
       eleventy --serve

Arguments:

     --version

     --input=.
       Input template files (default: \`.\`)

     --output=_site
       Write HTML output to this folder (default: \`_site\`)

     --serve
       Run web server on --port (default 8080) and watch them too

     --port
       Run the --serve web server on this port (default 8080)

     --watch
       Wait for files to change and automatically rewrite (no web server)

     --incremental
       Only build the files that have changed. Best with watch/serve.

     --incremental=filename.md
       Does not require watch/serve. Run an incremental build targeting a single file.

     --ignore-initial
       Start without a build; build when files change. Works best with watch/serve/incremental.

     --formats=liquid,md
       Allow only certain template types (default: \`*\`)

     --quiet
       Don’t print all written files (off by default)

     --config=filename.js
       Override the eleventy config file path (default: \`.eleventy.js\`)

     --pathprefix='/'
       Change all url template filters to use this subdirectory.

     --dryrun
       Don’t write any files. Useful in DEBUG mode, for example: \`DEBUG=Eleventy* npx @11ty/eleventy --dryrun\`

     --loader
       Set to "esm" to force ESM mode, "cjs" to force CommonJS mode, or "auto" (default) to infer it from package.json.

     --to=json
     --to=ndjson
       Change the output to JSON or NDJSON (default: \`fs\`)

     --help`;
	}

	/**
	 * @deprecated since 1.0.1, use static Eleventy.getHelp()
	 */
	getHelp() {
		return Eleventy.getHelp();
	}

	/**
	 * Resets the config of Eleventy.
	 *
	 * @method
	 */
	resetConfig() {
		delete this.eleventyConfig;

		// ensures `initializeConfig()` will run when `init()` is called next
		this.#hasConfigInitialized = false;
	}

	/**
	 * @param {string} changedFilePath - File that triggered a re-run (added or modified)
	 * @param {boolean} [isResetConfig] - are we doing a config reset
	 */
	async #addFileToWatchQueue(changedFilePath, isResetConfig) {
		// Currently this is only for 11ty.js deps but should be extended with usesGraph
		let usedByDependants = [];
		if (this.watchTargets) {
			usedByDependants = this.watchTargets.getDependantsOf(
				TemplatePath.addLeadingDotSlash(changedFilePath),
			);
		}

		let relevantLayouts = this.eleventyConfig.usesGraph.getLayoutsUsedBy(changedFilePath);

		// `eleventy.templateModified` is no longer used internally, remove in a future major version.
		eventBus.emit("eleventy.templateModified", changedFilePath, {
			usedByDependants,
			relevantLayouts,
		});

		// These listeners are *global*, not cleared even on config reset
		eventBus.emit("eleventy.resourceModified", changedFilePath, usedByDependants, {
			viaConfigReset: isResetConfig,
			relevantLayouts,
		});

		this.config.events.emit("eleventy#templateModified", changedFilePath);

		this.watchManager.addToPendingQueue(changedFilePath);
	}

	shouldTriggerConfigReset(changedFiles) {
		let configFilePaths = new Set(this.eleventyConfig.getLocalProjectConfigFiles());
		let resetConfigGlobs = EleventyWatchTargets.normalizeToGlobs(
			Array.from(this.eleventyConfig.userConfig.watchTargetsConfigReset),
		);
		for (let filePath of changedFiles) {
			if (configFilePaths.has(filePath)) {
				return true;
			}
			if (isGlobMatch(filePath, resetConfigGlobs)) {
				return true;
			}
		}

		for (const configFilePath of configFilePaths) {
			// Any dependencies of the config file changed
			let configFileDependencies = new Set(this.watchTargets.getDependenciesOf(configFilePath));

			for (let filePath of changedFiles) {
				if (configFileDependencies.has(filePath)) {
					return true;
				}
			}
		}

		return false;
	}

	// Checks the build queue to see if any configuration related files have changed
	#shouldResetConfig(activeQueue = []) {
		if (!activeQueue.length) {
			return false;
		}

		return this.shouldTriggerConfigReset(
			activeQueue.map((path) => {
				return PathNormalizer.normalizeSeperator(TemplatePath.addLeadingDotSlash(path));
			}),
		);
	}

	async #watch(isResetConfig = false) {
		if (this.watchManager.isBuildRunning()) {
			return;
		}

		this.watchManager.setBuildRunning();

		let queue = this.watchManager.getActiveQueue();

		await this.config.events.emit("beforeWatch", queue);
		await this.config.events.emit("eleventy.beforeWatch", queue);

		// Clear `import` cache for all files that triggered the rebuild (sync event)
		this.watchTargets.clearImportCacheFor(queue);

		// reset and reload global configuration
		if (isResetConfig) {
			// important: run this before config resets otherwise the handlers will disappear.
			await this.config.events.emit("eleventy.reset");
			this.resetConfig();
		}

		await this.restart();
		await this.init({ viaConfigReset: isResetConfig });

		try {
			let [passthroughCopyResults, templateResults] = await this.write();

			this.watchTargets.reset();

			await this.#initWatchDependencies();

			// Add new deps to chokidar
			this.watcher.add(this.watchTargets.getNewTargetsSinceLastReset());

			// Is a CSS input file and is not in the includes folder
			// TODO check output path file extension of this template (not input path)
			// TODO add additional API for this, maybe a config callback?
			let onlyCssChanges = this.watchManager.hasAllQueueFiles((path) => {
				return (
					path.endsWith(".css") &&
					// TODO how to make this work with relative includes?
					!TemplatePath.startsWithSubPath(path, this.eleventyFiles.getIncludesDir())
				);
			});

			let files = this.watchManager.getActiveQueue();

			// Maps passthrough copy files to output URLs for CSS live reload
			let stylesheetUrls = new Set();
			for (let entry of passthroughCopyResults) {
				for (let filepath in entry.map) {
					if (
						filepath.endsWith(".css") &&
						files.includes(TemplatePath.addLeadingDotSlash(filepath))
					) {
						stylesheetUrls.add(
							"/" + TemplatePath.stripLeadingSubPath(entry.map[filepath], this.outputDir),
						);
					}
				}
			}

			let normalizedPathPrefix = PathPrefixer.normalizePathPrefix(this.config.pathPrefix);
			let matchingTemplates = templateResults
				.flat()
				.filter((entry) => Boolean(entry))
				.map((entry) => {
					// only `url`, `inputPath`, and `content` are used: https://github.com/11ty/eleventy-dev-server/blob/1c658605f75224fdc76f68aebe7a412eeb4f1bc9/client/reload-client.js#L140
					entry.url = PathPrefixer.joinUrlParts(normalizedPathPrefix, entry.url);
					delete entry.rawInput; // Issue #3481
					return entry;
				});

			await this.eleventyServe.reload({
				files,
				subtype: onlyCssChanges ? "css" : undefined,
				build: {
					stylesheets: Array.from(stylesheetUrls),
					templates: matchingTemplates,
				},
			});
		} catch (error) {
			this.eleventyServe.sendError({
				error,
			});
		}

		this.watchManager.setBuildFinished();

		let queueSize = this.watchManager.getPendingQueueSize();
		if (queueSize > 0) {
			this.logger.log(
				`You saved while Eleventy was running, let’s run again. (${queueSize} change${
					queueSize !== 1 ? "s" : ""
				})`,
			);
			await this.#watch();
		} else {
			this.logger.log("Watching…");
		}
	}

	/**
	 * @returns {module:11ty/eleventy/src/Benchmark/BenchmarkGroup~BenchmarkGroup}
	 */
	get watcherBench() {
		return this.bench.get("Watcher");
	}

	/**
	 * Set up watchers and benchmarks.
	 *
	 * @async
	 * @method
	 */
	async initWatch() {
		this.watchManager = new EleventyWatch();
		this.watchManager.incremental = this.isIncremental;

		if (this.projectPackageJsonPath) {
			this.watchTargets.add([
				path.relative(TemplatePath.getWorkingDir(), this.projectPackageJsonPath),
			]);
		}
		this.watchTargets.add(this.eleventyFiles.getGlobWatcherFiles());
		this.watchTargets.add(this.eleventyFiles.getIgnoreFiles());

		// Watch the local project config file
		this.watchTargets.add(this.eleventyConfig.getLocalProjectConfigFiles());

		// Template and Directory Data Files
		this.watchTargets.add(await this.eleventyFiles.getGlobWatcherTemplateDataFiles());

		let benchmark = this.watcherBench.get(
			"Watching JavaScript Dependencies (disable with `eleventyConfig.setWatchJavaScriptDependencies(false)`)",
		);
		benchmark.before();
		await this.#initWatchDependencies();
		benchmark.after();
	}

	// fetch from project’s package.json
	get projectPackageJsonPath() {
		if (this.#projectPackageJsonPath === undefined) {
			this.#projectPackageJsonPath = getWorkingProjectPackageJsonPath() || false;
		}
		return this.#projectPackageJsonPath;
	}

	get projectPackageJson() {
		if (!this.#projectPackageJson) {
			let p = this.projectPackageJsonPath;
			this.#projectPackageJson = p ? importJsonSync(p) : {};
		}
		return this.#projectPackageJson;
	}

	get isEsm() {
		if (this.#isEsm !== undefined) {
			return this.#isEsm;
		}
		if (this.loader == "esm") {
			this.#isEsm = true;
		} else if (this.loader == "cjs") {
			this.#isEsm = false;
		} else if (this.loader == "auto") {
			this.#isEsm = this.projectPackageJson?.type === "module";
		} else {
			throw new Error("The 'loader' option must be one of 'esm', 'cjs', or 'auto'");
		}
		return this.#isEsm;
	}

	/**
	 * Starts watching dependencies.
	 */
	async #initWatchDependencies() {
		if (!this.eleventyConfig.shouldSpiderJavaScriptDependencies()) {
			return;
		}

		// TODO use DirContains
		let dataDir = TemplatePath.stripLeadingDotSlash(this.templateData.getDataDir());
		function filterOutGlobalDataFiles(path) {
			return !dataDir || !TemplatePath.stripLeadingDotSlash(path).startsWith(dataDir);
		}

		// Lazy resolve isEsm only for --watch
		this.watchTargets.setProjectUsingEsm(this.isEsm);

		// Template files .11ty.js
		let templateFiles = await this.eleventyFiles.getWatchPathCache();
		await this.watchTargets.addDependencies(templateFiles);

		// Config file dependencies
		await this.watchTargets.addDependencies(
			this.eleventyConfig.getLocalProjectConfigFiles(),
			filterOutGlobalDataFiles,
		);

		// Deps from Global Data (that aren’t in the global data directory, everything is watched there)
		let globalDataDeps = this.templateData.getWatchPathCache();
		await this.watchTargets.addDependencies(globalDataDeps, filterOutGlobalDataFiles);

		await this.watchTargets.addDependencies(
			await this.eleventyFiles.getWatcherTemplateJavaScriptDataFiles(),
		);
	}

	/**
	 * Returns all watched files.
	 *
	 * @async
	 * @method
	 * @returns {Promise<Array>} targets - The watched files.
	 */
	async getWatchedFiles() {
		return this.watchTargets.getTargets();
	}

	getChokidarConfig() {
		let ignores = this.eleventyFiles.getGlobWatcherIgnores();
		debug("Ignoring watcher changes to: %o", ignores);

		let configOptions = this.config.chokidarConfig;

		// can’t override these yet
		// TODO maybe if array, merge the array?
		delete configOptions.ignored;

		return Object.assign(
			{
				ignored: ignores,
				ignoreInitial: true,
				awaitWriteFinish: {
					stabilityThreshold: 150,
					pollInterval: 25,
				},
			},
			configOptions,
		);
	}

	/**
	 * Start the watching of files
	 *
	 * @async
	 * @method
	 */
	async watch() {
		this.watcherBench.setMinimumThresholdMs(500);
		this.watcherBench.reset();

		// We use a string module name and try/catch here to hide this from the zisi and esbuild serverless bundlers
		let chokidar;
		// eslint-disable-next-line no-useless-catch
		try {
			let moduleName = "@11ty/chokidar-with-glob-support";
			let chokidarImport = await import(moduleName);
			chokidar = chokidarImport.default;
		} catch (e) {
			throw e;
		}

		// Note that watching indirectly depends on this for fetching dependencies from JS files
		// See: TemplateWriter:pathCache and EleventyWatchTargets
		await this.write();

		let initWatchBench = this.watcherBench.get("Start up --watch");
		initWatchBench.before();

		await this.initWatch();

		// TODO improve unwatching if JS dependencies are removed (or files are deleted)
		let rawFiles = await this.getWatchedFiles();
		debug("Watching for changes to: %o", rawFiles);

		let options = this.getChokidarConfig();

		// Remap all paths to `cwd` if in play (Issue #3854)
		let remapper = new FileSystemRemap(rawFiles);
		let cwd = remapper.getCwd();

		if (cwd) {
			options.cwd = cwd;

			rawFiles = remapper.getInput().map((entry) => {
				return TemplatePath.stripLeadingDotSlash(entry);
			});

			options.ignored = remapper.getRemapped(options.ignored || []).map((entry) => {
				return TemplatePath.stripLeadingDotSlash(entry);
			});
		}

		let watcher = chokidar.watch(rawFiles, options);

		initWatchBench.after();

		this.watcherBench.finish("Watch");

		this.logger.forceLog("Watching…");

		this.watcher = watcher;

		let watchDelay;
		let watchRun = async (path) => {
			path = TemplatePath.normalize(path);
			try {
				let isResetConfig = this.#shouldResetConfig([path]);
				this.#addFileToWatchQueue(path, isResetConfig);

				clearTimeout(watchDelay);

				let { promise, resolve, reject } = withResolvers();

				watchDelay = setTimeout(async () => {
					this.#watch(isResetConfig).then(resolve, reject);
				}, this.config.watchThrottleWaitTime);

				await promise;
			} catch (e) {
				if (e instanceof EleventyBaseError) {
					this.errorHandler.error(e, "Eleventy watch error");
					this.watchManager.setBuildFinished();
				} else {
					this.errorHandler.fatal(e, "Eleventy fatal watch error");
					await this.stopWatch();
				}
			}

			this.config.events.emit("eleventy.afterwatch");
		};

		watcher.on("change", async (path) => {
			// Emulated passthrough copy logs from the server
			if (!this.eleventyServe.isEmulatedPassthroughCopyMatch(path)) {
				this.logger.forceLog(`File changed: ${TemplatePath.standardizeFilePath(path)}`);
			}

			await watchRun(path);
		});

		watcher.on("add", async (path) => {
			// Emulated passthrough copy logs from the server
			if (!this.eleventyServe.isEmulatedPassthroughCopyMatch(path)) {
				this.logger.forceLog(`File added: ${TemplatePath.standardizeFilePath(path)}`);
			}

			this.fileSystemSearch.add(path);
			await watchRun(path);
		});

		watcher.on("unlink", (path) => {
			this.logger.forceLog(`File deleted: ${TemplatePath.standardizeFilePath(path)}`);
			this.fileSystemSearch.delete(path);
		});

		// wait for chokidar to be ready.
		await new Promise((resolve) => {
			watcher.on("ready", () => resolve());
		});

		// Returns for testability
		return watchRun;
	}

	async stopWatch() {
		// Prevent multiple invocations.
		if (this.#isStopping) {
			return this.#isStopping;
		}

		debug("Cleaning up chokidar and server instances, if they exist.");
		this.#isStopping = Promise.all([this.eleventyServe.close(), this.watcher?.close()]).then(() => {
			this.#isStopping = false;
		});

		return this.#isStopping;
	}

	/**
	 * Serve Eleventy on this port.
	 *
	 * @param {Number} port - The HTTP port to serve Eleventy from.
	 */
	async serve(port) {
		// Port is optional and in this case likely via --port on the command line
		// May defer to configuration API options `port` property
		return this.eleventyServe.serve(port);
	}

	/**
	 * Writes templates to the file system.
	 *
	 * @async
	 * @method
	 * @returns {Promise<{Array}>}
	 */
	async write() {
		return this.executeBuild("fs");
	}

	/**
	 * Renders templates to a JSON object.
	 *
	 * @async
	 * @method
	 * @returns {Promise<{Array}>}
	 */
	async toJSON() {
		return this.executeBuild("json");
	}

	/**
	 * Returns a stream of new line delimited (NDJSON) objects
	 *
	 * @async
	 * @method
	 * @returns {Promise<{ReadableStream}>}
	 */
	async toNDJSON() {
		return this.executeBuild("ndjson");
	}

	/**
	 * tbd.
	 *
	 * @async
	 * @method
	 * @returns {Promise<{Array,ReadableStream}>} ret - tbd.
	 */
	async executeBuild(to = "fs") {
		if (this.#needsInit) {
			if (!this.#initPromise) {
				this.#initPromise = this.init();
			}
			await this.#initPromise.then(() => {
				// #needsInit also set to false at the end of `init()`
				this.#needsInit = false;
				this.#initPromise = undefined;
			});
		}

		if (!this.writer) {
			throw new Error(
				"Internal error: Eleventy didn’t run init() properly and wasn’t able to create a TemplateWriter.",
			);
		}

		let incrementalFile =
			this.programmaticApiIncrementalFile || this.watchManager?.getIncrementalFile();
		if (incrementalFile) {
			this.writer.setIncrementalFile(incrementalFile);
		}

		let returnObj;
		let hasError = false;

		try {
			let directories = this.directories.getUserspaceInstance();
			let eventsArg = {
				directories,

				// v3.0.0-alpha.6, changed to use `directories` instead (this was only used by serverless plugin)
				inputDir: directories.input,

				// Deprecated (not normalized) use `directories` instead.
				dir: this.config.dir,

				runMode: this.runMode,
				outputMode: to,
				incremental: this.isIncremental,
			};

			await this.config.events.emit("beforeBuild", eventsArg);
			await this.config.events.emit("eleventy.before", eventsArg);

			let promise;
			if (to === "fs") {
				promise = this.writer.write();
			} else if (to === "json") {
				promise = this.writer.getJSON("json");
			} else if (to === "ndjson") {
				promise = this.writer.getJSON("ndjson");
			} else {
				throw new Error(
					`Invalid argument for \`Eleventy->executeBuild(${to})\`, expected "json", "ndjson", or "fs".`,
				);
			}

			let resolved = await promise;

			// Passing the processed output to the eleventy.after event (2.0+)
			eventsArg.results = resolved.templates;

			if (to === "ndjson") {
				// return a stream
				// TODO this outputs all ndjson rows after all the templates have been written to the stream
				returnObj = this.logger.closeStream();
			} else if (to === "json") {
				// Backwards compat
				returnObj = resolved.templates;
			} else {
				// Backwards compat
				returnObj = [resolved.passthroughCopy, resolved.templates];
			}

			this.unsetIncrementalFile();
			this.writer.resetIncrementalFile();

			eventsArg.uses = this.eleventyConfig.usesGraph.map;
			await this.config.events.emit("afterBuild", eventsArg);
			await this.config.events.emit("eleventy.after", eventsArg);

			this.buildCount++;
		} catch (error) {
			hasError = true;

			// Issue #2405: Don’t change the exitCode for programmatic scripts
			let errorSeverity = this.source === "script" ? "error" : "fatal";
			this.errorHandler.once(errorSeverity, error, "Problem writing Eleventy templates");

			// TODO ndjson should stream the error but https://github.com/11ty/eleventy/issues/3382
			throw error;
		} finally {
			this.bench.finish();

			if (to === "fs") {
				this.logger.logWithOptions({
					message: this.logFinished(),
					color: hasError ? "red" : "green",
					force: true,
				});
			}

			debug("Finished.");

			debug(`
Have a suggestion/feature request/feedback? Feeling frustrated? I want to hear it!
Open an issue: https://github.com/11ty/eleventy/issues/new`);
		}

		return returnObj;
	}
}

export default Eleventy;

// extend for exporting to CJS
Object.assign(RenderPlugin, RenderPluginExtras);
Object.assign(I18nPlugin, I18nPluginExtras);
Object.assign(HtmlBasePlugin, HtmlBasePluginExtras);

// Removed plugins

const EleventyServerlessBundlerPlugin = function () {
	throw new Error(
		"Following feedback from our Community Survey, low interest in this plugin prompted its removal from Eleventy core in 3.0 as we refocus on static sites. Learn more: https://v3.11ty.dev/docs/plugins/serverless/",
	);
};

const EleventyEdgePlugin = function () {
	throw new Error(
		"Following feedback from our Community Survey, low interest in this plugin prompted its removal from Eleventy core in 3.0 as we refocus on static sites. Learn more: https://v3.11ty.dev/docs/plugins/edge/",
	);
};

export {
	Eleventy,
	EleventyImport as ImportFile,

	// Error messages for removed plugins
	EleventyServerlessBundlerPlugin as EleventyServerless,
	EleventyServerlessBundlerPlugin,
	EleventyEdgePlugin,

	/**
	 * @type {module:11ty/eleventy/Plugins/RenderPlugin}
	 */
	RenderPlugin as EleventyRenderPlugin, // legacy name
	/**
	 * @type {module:11ty/eleventy/Plugins/RenderPlugin}
	 */
	RenderPlugin,

	/**
	 * @type {module:11ty/eleventy/Plugins/I18nPlugin}
	 */
	I18nPlugin as EleventyI18nPlugin, // legacy name
	/**
	 * @type {module:11ty/eleventy/Plugins/I18nPlugin}
	 */
	I18nPlugin,

	/**
	 * @type {module:11ty/eleventy/Plugins/HtmlBasePlugin}
	 */
	HtmlBasePlugin as EleventyHtmlBasePlugin, // legacy name
	/**
	 * @type {module:11ty/eleventy/Plugins/HtmlBasePlugin}
	 */
	HtmlBasePlugin,

	/**
	 * @type {module:11ty/eleventy/Plugins/InputPathToUrlTransformPlugin}
	 */
	InputPathToUrlTransformPlugin,

	/**
	 * @type {module:11ty/eleventy-plugin-bundle}
	 */
	BundlePlugin,

	/**
	 * @type {module:11ty/eleventy/Plugins/IdAttributePlugin}
	 */
	IdAttributePlugin,
};
