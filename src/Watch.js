import { TemplatePath } from "@11ty/eleventy-utils";
import chokidar from "@11ty/chokidar-with-glob-support";

export class Watch {
	/** @type {module:chokidar} */
	#chokidar;
	/** @type {Array} */
	#watchedGlobs = [];
	/** @type {Array} */
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
				nocase: true,
				awaitWriteFinish: {
					stabilityThreshold: 150,
					pollInterval: 25,
				},
			},
			this.templateConfig.userConfig.chokidarConfig,
		);

		// globs, paths, RegExps, or functions
		options.ignored = [options.ignored ?? []].flat();

		return options;
	}

	// alias for watchTargets() (backwards compat)
	add(targets = []) {
		this.watchTargets(targets);
	}

	watchTargets(targets = []) {
		// Any iterable (Serve passes a Set)
		let globs = Array.from(targets, (target) => TemplatePath.stripLeadingDotSlash(target));
		this.#watchedGlobs.push(...globs);
		this.#chokidar?.add(globs);
	}

	addIgnores(ignores) {
		for (let target of ignores) {
			this.#ignoredGlobs.push(target);
		}
	}

	async start() {
		let options = this.getChokidarConfig();
		options.ignored = [...this.#ignoredGlobs, ...options.ignored];

		this.#chokidar = chokidar.watch(this.#watchedGlobs, options);

		// Note: if there are no watch targets the `ready` event doesn’t fire so skip it
		if (this.#watchedGlobs.length > 0) {
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
