import { TemplatePath } from "@11ty/eleventy-utils";
import chokidar from "chokidar";

import { createDebug } from "./Util/DebugLogUtil.js";
import { isGlobMatch } from "./Util/GlobMatcher.js";
import { GlobStripper } from "./Util/GlobStripper.js";

const debug = createDebug("Watch");

export class Watch {
	/** @type {module:chokidar} */
	#chokidar;
	/** @type {Set} */
	#watchedGlobs = [];
	/** @type {Set} */
	#ignoredGlobs = [];
	/** @type {Promise} */
	#ready;

	constructor(config) {
		if (!config || config.constructor.name !== "TemplateConfig") {
			throw new Error("Internal error: Missing or invalid `config` argument.");
		}
		this.templateConfig = config;
	}

	getChokidarConfig() {
		let options = Object.assign(
			{
				ignoreInitial: true,
				awaitWriteFinish: {
					stabilityThreshold: 150,
					pollInterval: 25,
				},
			},
			this.templateConfig.userConfig.chokidarConfig,
		);

		// unsupported: using your own `ignored`
		if (options.ignored) {
			delete options.ignored;
		}

		return options;
	}

	// alias for watchTargets() (backwards compat)
	add(targets = []) {
		this.watchTargets(targets);
	}

	watchTargets(targets = []) {
		let uniqueSet = new Set();
		for (let target of targets) {
			this.#watchedGlobs.push(TemplatePath.stripLeadingDotSlash(target));

			// strip globs off of target, chokidar@4
			let { path } = GlobStripper.parse(target);
			if (path) {
				uniqueSet.add(path);
			}
		}

		this.#chokidar?.add(Array.from(uniqueSet));
	}

	addIgnores(ignores) {
		for (let target of ignores) {
			this.#ignoredGlobs.push(target);
		}
	}

	#isDirectory(path) {
		return this.templateConfig.existsCache.isDirectory(path);
	}

	async start() {
		let options = this.getChokidarConfig();

		options.ignored = (filepath) => {
			// don’t ignore root (if specified)
			if (filepath === ".") {
				return false;
			}

			if (this.#ignoredGlobs.length > 0 && isGlobMatch(filepath, this.#ignoredGlobs)) {
				debug("Ignore file (ignore globs)", filepath);
				return true;
			}

			// don’t ignore directories that are not in ignores
			if (this.#isDirectory(filepath)) {
				return false;
			}

			// make sure this matches at least one of the original globs
			if (this.#watchedGlobs.length === 0 || !isGlobMatch(filepath, this.#watchedGlobs)) {
				debug("Ignore file (no glob match)", filepath, this.#watchedGlobs);
				return true;
			}

			return false;
		};

		// strip globs off of target, chokidar@4
		let targets = this.#watchedGlobs
			.map((target) => {
				let { path } = GlobStripper.parse(target);
				return path;
			})
			.filter(Boolean);
		this.#chokidar = chokidar.watch(targets, options);

		// Note: if there are no watch targets the `ready` event doesn’t fire so skip it
		if (targets.length > 0) {
			this.#ready = await new Promise((resolve) => {
				this.#chokidar.on("ready", () => resolve());
			});
		} else {
			this.#ready = Promise.resolve();
		}
	}

	async getWatched() {
		if (this.#ready) {
			await this.#ready;
		}

		return this.#chokidar.getWatched();
	}

	on(event, callback) {
		this.#chokidar.on(event, callback);
	}

	emit(event, ...args) {
		this.#chokidar.emit(event, ...args);
	}

	async close() {
		return this.#chokidar?.close();
	}
}
