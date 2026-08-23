import { relative } from "node:path";

import { TemplatePath } from "@11ty/eleventy-utils";

import { CoreFs } from "./CoreFs.js";
import Serve from "./Serve.js";
import { Watch } from "./Watch.js";
import WatchQueue from "./WatchQueue.js";
import WatchTargets from "./WatchTargets.js";
import BaseError from "./Errors/BaseError.js";

// Utils
import { createDebug } from "./Util/DebugLogUtil.js";
import checkPassthroughCopyBehavior from "./Util/PassthroughCopyBehaviorCheck.js";
import PathPrefixer from "./Util/PathPrefixer.js";
import PathNormalizer from "./Util/PathNormalizer.js";
import { isGlobMatch } from "./Util/GlobMatcher.js";
import eventBus from "./EventBus.js";

const debug = createDebug("Core");

export default class Core extends CoreFs {
	/** @type {boolean} */
	#isStopping = false;

	/** @type {WatchQueue} */
	#watchQueue;

	#watchDelay;
	#interrupted = false;

	get watchQueue() {
		if (!this.#watchQueue) {
			this.#watchQueue = new WatchQueue();
		}
		return this.#watchQueue;
	}

	async initializeConfig(initOverrides) {
		await super.initializeConfig(initOverrides);

		// Careful to make sure the previous server closes on SIGINT, issue #3873
		if (!this.eleventyServe) {
			/** @type {object} */
			this.eleventyServe = new Serve();
		}

		this.eleventyServe.logger = this.logger;
		this.eleventyServe.eleventyConfig = this.eleventyConfig;

		/** @type {object} */
		this.watchTargets = new WatchTargets(this.eleventyConfig);
		this.watchTargets.add(this.config.additionalWatchTargets);
	}

	async resetConfig() {
		await super.resetConfig();

		// TODO set this.eleventyServe with this.getChokidarConfig()
		if (checkPassthroughCopyBehavior(this.config, this.runMode)) {
			this.eleventyServe.resetConfig();
		}
	}

	/**
	 * Starts Eleventy.
	 */
	async init(options = {}) {
		await super.init(options);

		// eleventyServe is always available, even when not in --serve mode
		// TODO directorynorm
		this.eleventyServe.setOutputDir(this.outputDir);

		if (checkPassthroughCopyBehavior(this.config, this.runMode)) {
			this.eleventyServe.watchPassthroughCopy(
				this.eleventyFiles.getGlobWatcherFilesForPassthroughCopy(),
			);
		}
	}

	/**
	 * @param {string} changedFilePath - File that triggered a re-run (added or modified)
	 */
	#resetFileInWatchQueue(changedFilePath) {
		// v3.1.0: `eleventy.templateModified` is no longer used internally
		// v4.0.0-alpha.8 `eleventy.templateModified` event removed

		// These listeners are *global*, not cleared even on config reset (v4.0.0-alpha.8 removed some arguments here)
		eventBus.emit("buildawesome.resourcemodified", changedFilePath);

		this.config.events.emit("buildawesome#templatemodified", changedFilePath);
	}

	shouldTriggerConfigReset(changedFiles) {
		// looks for all eligible config files (not just the active one, handles config file rename)
		let configFilePaths = new Set(this.eleventyConfig.getLocalProjectConfigFiles());

		// https://www.11ty.dev/docs/watch-serve/#reset-configuration
		let resetConfigGlobs = WatchTargets.normalizeToGlobs(
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

		for (let configFilePath of configFilePaths) {
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

	async #rewatch() {
		if (this.watchQueue.isBuildRunning()) {
			// this.logger.forceLog("Waiting for previous build to finish…");
			return;
		}

		this.watchQueue.startBuild();

		let queue = this.watchQueue.getActiveQueue();
		let isResetConfig = this.#shouldResetConfig(queue);

		for (let p of queue) {
			this.#resetFileInWatchQueue(p, isResetConfig);
		}

		this.logger.forceLog(
			`Build starting${queue.length > 1 ? ` (${queue.length} queued changes)` : ""}…` +
				(isResetConfig ? " (configuration reset)" : ""),
		);

		await this.config.events.emit("buildawesome.beforewatch", queue);

		// Clear `import` cache for all files that triggered the rebuild (sync event)
		this.watchTargets.clearImportCacheFor(queue);

		// reset and reload global configuration
		if (isResetConfig) {
			// important: run this before config resets otherwise the handlers will disappear.
			await this.config.events.emit("buildawesome.reset");
			this.resetConfig();
		}

		await this.restart();
		await this.init({ viaConfigReset: isResetConfig });

		try {
			let [passthroughCopyResults, templateResults] = await this.write();

			if (isResetConfig) {
				// make sure this happens after write()
				await this.startWatch();
			}

			this.watchTargets.reset();

			await this.#initWatchDependencies();

			// Add new deps to chokidar
			let newWatchTargets = this.watchTargets.getNewTargetsSinceLastReset();
			this.watcher.watchTargets(newWatchTargets);

			// Is a CSS input file and is not in the includes folder
			// TODO check output path file extension of this template (not input path)
			// TODO add additional API for this, maybe a config callback?
			let onlyCssChanges = this.watchQueue.hasAllQueueFiles((path) => {
				return (
					path.endsWith(".css") &&
					// TODO how to make this work with relative includes?
					!TemplatePath.startsWithSubPath(path, this.eleventyFiles.getIncludesDir())
				);
			});

			// Maps passthrough copy files to output URLs for CSS live reload
			let stylesheetUrls = new Set();
			for (let entry of passthroughCopyResults) {
				for (let filepath in entry.map) {
					if (
						filepath.endsWith(".css") &&
						queue.includes(TemplatePath.addLeadingDotSlash(filepath))
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
				files: queue,
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

		this.watchQueue.finishBuild();

		// Re-fetch
		let pendingQueue = this.watchQueue.getPendingQueue();
		if (pendingQueue.length > 0) {
			await this.#rewatch();
		} else if (!this.#interrupted) {
			// also logs in startWatch for initial build
			this.logger.forceLog(`Waiting…`);
		}
	}

	/*
	 * SIGINT
	 */
	interrupt() {
		this.#interrupted = true;

		// Clear the queue to prevent additional builds
		this.watchQueue.reset();
	}

	/**
	 * @returns {module:11ty/eleventy/src/Benchmark/BenchmarkGroup~BenchmarkGroup}
	 */
	get watcherBench() {
		return this.bench.get("Watcher");
	}

	async waitThrottle() {
		if (this.#watchDelay) {
			clearTimeout(this.#watchDelay);
		}

		if (this.config.watchThrottleWaitTime > 0) {
			let { promise, resolve } = Promise.withResolvers();

			this.#watchDelay = setTimeout(resolve, this.config.watchThrottleWaitTime);

			return promise;
		}
	}

	// Triggers when files are modified on file system
	async triggerWatchRunForPath(path) {
		this.watchQueue.addToPendingQueue(path);

		await this.waitThrottle();

		try {
			await this.#rewatch();
		} catch (e) {
			this.watchQueue.finishBuild();

			if (e instanceof BaseError) {
				this.errorHandler.error(e, "Eleventy watch error");
			} else {
				this.errorHandler.fatal(e, "Eleventy fatal watch error");
				await this.close();
			}
		}

		// Internal event for testing
		// v4.0.0-alpha.8 swapped to async-friendly
		await this.config.events.emit("buildawesome.afterwatch");
	}

	/**
	 * Set up watchers and benchmarks.
	 *
	 * @async
	 * @method
	 */
	async startWatch() {
		if (this.projectPackageJsonPath) {
			this.watchTargets.add([relative(TemplatePath.getWorkingDir(), this.projectPackageJsonPath)]);
		}
		this.watchTargets.add(this.eleventyFiles.getGlobWatcherFiles());
		this.watchTargets.add(this.eleventyFiles.getIgnoreFiles());

		// Watch the local project config file
		this.watchTargets.add(this.eleventyConfig.getActiveConfigPath());

		// Template and Directory Data Files
		this.watchTargets.add(this.eleventyFiles.getGlobWatcherTemplateDataFiles());

		let benchmark = this.watcherBench.get(
			"Watching JavaScript Dependencies (disable with `eleventyConfig.setWatchJavaScriptDependencies(false)`)",
		);
		benchmark.before();
		await this.#initWatchDependencies();
		benchmark.after();

		// Close previous watcher
		if (this.watcher) {
			await this.watcher.close();
		}

		// TODO improve unwatching if JS dependencies are removed (or files are deleted)
		let { targets, ignores } = await this.getWatchedTargets();
		debug("Watching for changes to: %o", targets);

		this.watcher = new Watch(this.eleventyConfig);
		this.watcher.watchTargets(targets);
		this.watcher.addIgnores(ignores);

		await this.watcher.start();

		// This logs in #rewatch for rebuilds
		if (this.buildCount <= 1) {
			this.logger.forceLog("Waiting…");
		}

		this.watcher.on("change", async (path) => {
			// Emulated passthrough copy logs from the server
			if (!this.eleventyServe.isEmulatedPassthroughCopyMatch(path)) {
				this.logger.forceLog(
					`File changed: ${TemplatePath.stripLeadingDotSlash(TemplatePath.standardizeFilePath(path))}${this.watchQueue.isBuildRunning() ? " (queued for next build)" : ""}`,
				);
			}

			// don’t await
			this.triggerWatchRunForPath(path);
		});

		this.watcher.on("add", async (path) => {
			// Emulated passthrough copy logs from the server
			if (!this.eleventyServe.isEmulatedPassthroughCopyMatch(path)) {
				this.logger.forceLog(
					`File added: ${TemplatePath.stripLeadingDotSlash(TemplatePath.standardizeFilePath(path))}${this.watchQueue.isBuildRunning() ? " (queued for next build)" : ""}`,
				);
			}

			this.fileSystemSearch.add(path);
			// don’t await
			this.triggerWatchRunForPath(path);
		});

		this.watcher.on("unlink", async (path) => {
			// Emulated passthrough copy logs from the server
			if (!this.eleventyServe.isEmulatedPassthroughCopyMatch(path)) {
				this.logger.forceLog(
					`File deleted: ${TemplatePath.stripLeadingDotSlash(TemplatePath.standardizeFilePath(path))}${this.watchQueue.isBuildRunning() ? " (queued for next build)" : ""}`,
				);
			}

			this.fileSystemSearch.delete(path);
			// don’t await
			this.triggerWatchRunForPath(path);
		});
	}

	/**
	 * Starts watching dependencies.
	 */
	async #initWatchDependencies() {
		if (!this.eleventyConfig.shouldSpiderJavaScriptDependencies()) {
			return;
		}

		// Lazy resolve isEsm only for --watch
		this.watchTargets.setProjectUsingEsm(this.isEsm);

		// Template files .11ty.js
		let templateFiles = await this.eleventyFiles.getWatchPathCache();
		await this.watchTargets.addDependencies(templateFiles);

		// TODO use DirContains
		let dataDir = TemplatePath.stripLeadingDotSlash(this.templateData.getDataDir());
		function filterOutGlobalDataFiles(path) {
			return !dataDir || !TemplatePath.stripLeadingDotSlash(path).startsWith(dataDir);
		}

		// Config file dependencies
		await this.watchTargets.addDependencies(
			this.eleventyConfig.getActiveConfigPath(),
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
	 * Returns all watched paths
	 *
	 * @async
	 * @method
	 * @returns {Object} `targets` file paths, and `ignores` globs Array
	 */
	async getWatchedTargets() {
		return {
			targets: await this.watchTargets.getTargets(),
			ignores: this.eleventyFiles.getGlobWatcherIgnores(),
		};
	}

	/**
	 * Start watching files
	 *
	 * @async
	 * @method
	 */
	async watch() {
		this.watcherBench.setMinimumThresholdMs(500);
		this.watcherBench.reset();

		// Note that watching indirectly depends on this for fetching dependencies from JS files
		// See: TemplateWriter:pathCache and WatchTargets
		await this.write();

		let initWatchBench = this.watcherBench.get("Start up --watch");
		initWatchBench.before();

		await this.startWatch();

		initWatchBench.after();

		this.watcherBench.finish("Watch");
	}

	// Renamed to close()
	async stopWatch() {
		return this.close();
	}

	async close() {
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

     --incremental=first.md,second.md
     --incremental=first.md --incremental=second.md
       Does not require watch/serve. Run an incremental build targeting one or more files.

     --ignore-initial
       Start without a build; build when files change. Works best with watch/serve/incremental.

     --formats=liquid,md
       Allow only certain template types (default: \`*\`)

     --quiet
       Don’t print all written files (off by default)

     --config=filename.js
       Override the eleventy config file path (default: \`buildawesome.config.js\`)

     --pathprefix='/'
       Change all url template filters to use this subdirectory.

     --dryrun
       Don’t write any files. Useful in DEBUG mode, for example: \`DEBUG=Eleventy* npx @11ty/eleventy --dryrun\`

     --loader
       Set to "esm" to force ESM mode, "cjs" to force CommonJS mode, or "auto" (default) to infer it from package.json.

     --to=json
       Change the output to JSON (default: \`fs\`)

     --to=fs:templates
       Writes templates, skips passthrough copy

     --help`;
	}

	/**
	 * @deprecated since 1.0.1, use static getHelp() instead
	 */
	getHelp() {
		return Core.getHelp();
	}

	/* Removed methods */
	initWatch() {
		throw new Error(
			"#initWatch() was removed in v4. Use #startWatch() instead (initializes and starts the watcher)",
		);
	}
	getWatchedFiles() {
		throw new Error(
			"#getWatchedFiles() was removed in v4. Use #getWatchedTargets().targets instead.",
		);
	}
}

// Named export for backwards compatibility
export { Core as Eleventy };

/* Utils */
export { DynamicImport as ImportFile } from "./Util/Require.js";

// TODO(breaking) remove these and recommend folks use package level exports e.g. "@11ty/eleventy/plugins/i18n"

/* Plugins */
export { default as BundlePlugin } from "@11ty/eleventy-plugin-bundle";

// Eleventy*Plugin names are backwards-compatibility legacy names
export {
	default as RenderPlugin,
	default as EleventyRenderPlugin,
} from "./Plugins/RenderPlugin.js";
export { default as I18nPlugin, default as EleventyI18nPlugin } from "./Plugins/I18nPlugin.js";
export {
	default as HtmlBasePlugin,
	default as EleventyHtmlBasePlugin,
} from "./Plugins/HtmlBasePlugin.js";
export { TransformPlugin as InputPathToUrlTransformPlugin } from "./Plugins/InputPathToUrl.js";
export { IdAttributePlugin } from "./Plugins/IdAttributePlugin.js";

export { PreserveClosingTagsPlugin } from "./Plugins/PreserveClosingTagsPlugin.js";

// Error messages for Removed plugins
export function EleventyServerlessBundlerPlugin() {
	throw new Error(
		"Following feedback from our Community Survey, low interest in this plugin prompted its removal from core v3.0 as we refocus on static sites. Learn more: https://v3.11ty.dev/docs/plugins/serverless/",
	);
}

export { EleventyServerlessBundlerPlugin as EleventyServerless };

export function EleventyEdgePlugin() {
	throw new Error(
		"Following feedback from our Community Survey, low interest in this plugin prompted its removal from core v3.0 as we refocus on static sites. Learn more: https://v3.11ty.dev/docs/plugins/edge/",
	);
}
