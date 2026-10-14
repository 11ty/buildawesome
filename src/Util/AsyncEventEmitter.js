import { EventEmitter } from "node:events";

/**
 * This class emits events asynchronously.
 *
 * Note that Eleventy has two separate event emitter instances it uses:
 * 1. a userland one (UserConfig.js)
 * 2. a global one for internals (EventBus.js)
 *
 * @typedef {'parallel'|'sequential'} HandlerModeType
 */
class AsyncEventEmitter extends EventEmitter {
	// Breaking change v4.0.0-alpha.9, changed from "parallel". See #4293
	#handlerMode = "sequential";

	/* Order matters */
	#emitAliases = {
		"buildawesome.before": ["beforeBuild", "eleventy.before", "buildawesome.before"],
		"buildawesome.beforewatch": ["beforeWatch", "eleventy.beforeWatch", "buildawesome.beforewatch"],
		"buildawesome.beforeconfig": ["eleventy.beforeConfig", "buildawesome.beforeconfig"],
		"buildawesome.after": ["afterBuild", "eleventy.after", "buildawesome.after"],

		// Internal
		"buildawesome.engine.njk": ["eleventy.engine.njk", "buildawesome.engine.njk"],
		"buildawesome.globaldatafiles": ["eleventy.globalDataFiles", "buildawesome.globaldatafiles"],
		"buildawesome.contentmap": ["eleventy.contentMap", "buildawesome.contentmap"],
		"buildawesome.layouts": ["eleventy.layouts", "buildawesome.layouts"],
		"buildawesome.datafiles": ["eleventy.dataFiles", "buildawesome.datafiles"],
		"buildawesome.passthrough": ["eleventy.passthrough", "buildawesome.passthrough"],
		"buildawesome.config": ["eleventy.config", "buildawesome.config"],
		"buildawesome.env": ["eleventy.env", "buildawesome.env"],
		"buildawesome.extensionmap": ["eleventy.extensionmap", "buildawesome.extensionmap"],
		"buildawesome.directories": ["eleventy.directories", "buildawesome.directories"],
		"buildawesome.ignores": ["eleventy.ignores", "buildawesome.ignores"],
		"buildawesome.reset": ["eleventy.reset", "buildawesome.reset"],
		"buildawesome.afterwatch": ["eleventy.afterwatch", "buildawesome.afterwatch"],
		"buildawesome.resourcemodified": ["eleventy.resourceModified", "buildawesome.resourcemodified"],
		"buildawesome.compilecachereset": [
			"eleventy.compileCacheReset",
			"buildawesome.compilecachereset",
		],
		"buildawesome.importcachereset": ["eleventy.importCacheReset", "buildawesome.importcachereset"],

		"buildawesome#templatemodified": ["eleventy#templateModified", "buildawesome#templatemodified"],
		"buildawesome#copy": ["eleventy#copy", "buildawesome#copy"],

		// Internal but not aliased
		// "buildawesome#previousqueue"
		// "buildawesome#beforerender",
		// "buildawesome#render"
	};

	// TypeScript slop
	constructor(...args) {
		super(...args);
	}

	reset() {
		// `eleventy#` event type listeners are removed at the start of each build (singletons)
		for (let type of this.eventNames()) {
			if (
				typeof type === "string" &&
				(type.startsWith("eleventy#") || type.startsWith("buildawesome#"))
			) {
				this.removeAllListeners(type);
			}
		}
	}

	/**
	 * @param {string} type
	 *
	 */
	getAliasedListeners(type) {
		if (this.#emitAliases[type]) {
			let listeners = [];
			for (let alias of this.#emitAliases[type]) {
				listeners.push(...this.listeners(alias));
			}
			return listeners;
		}

		return this.listeners(type);
	}

	/**
	 * @param {string} type - The event name to emit.
	 * @param {...*} args - Additional arguments that get passed to listeners.
	 * @returns {Promise} - Promise resolves once all listeners were invoked
	 */
	/** @ts-expect-error */
	async emit(type, ...args) {
		let listeners = this.getAliasedListeners(type);
		if (listeners.length === 0) {
			return [];
		}

		if (this.#handlerMode == "sequential") {
			const result = [];
			for (const listener of listeners) {
				const returnValue = await listener.apply(this, args);
				result.push(returnValue);
			}
			return result;
		} else {
			return Promise.all(
				listeners.map((listener) => {
					return listener.apply(this, args);
				}),
			);
		}
	}

	/**
	 * @param {string} type - The event name to emit.
	 * @param {...*} args - Additional lazy-executed function arguments that get passed to listeners.
	 * @returns {Promise} - Promise resolves once all listeners were invoked
	 */
	async emitLazy(type, ...args) {
		let listeners = this.getAliasedListeners(type);
		if (listeners.length === 0) {
			return [];
		}

		let argsMap = [];
		for (let arg of args) {
			if (typeof arg === "function") {
				let r = arg();
				if (r instanceof Promise) {
					r = await r;
				}
				argsMap.push(r);
			} else {
				argsMap.push(arg);
			}
		}

		return this.emit.call(this, type, ...argsMap);
	}

	/** @param {HandlerModeType} mode  */
	setHandlerMode(mode) {
		this.#handlerMode = mode;
	}
}

export default AsyncEventEmitter;
