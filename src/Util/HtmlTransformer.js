import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { FilePathUtil } from "./FilePathUtil.js";

import { arrayDelete } from "./ArrayUtil.js";

export class HtmlTransformer {
	// feature test for Eleventy Bundle Plugin
	static SUPPORTS_PLUGINS_ENABLED_CALLBACK = true;

	static TYPES = ["callbacks", "plugins"];

	constructor() {
		// execution order is important (not order of addition/object key order)
		/** @type {object} */
		this.callbacks = {};

		/** @type {object} */
		this.posthtmlProcessOptions = {
			xmlMode: false,
			recognizeNoValueAttribute: true,
			closingSingleTag: "closeAs",
		};

		/** @type {object} */
		this.plugins = {};
	}

	get aggregateBench() {
		if (!this.userConfig) {
			throw new Error("Internal error: Missing `userConfig` in HtmlTransformer.");
		}
		return this.userConfig.benchmarkManager.get("Aggregate");
	}

	setUserConfig(config) {
		this.userConfig = config;
	}

	static prioritySort(a, b) {
		if (b.priority > a.priority) {
			return 1;
		}
		if (a.priority > b.priority) {
			return -1;
		}
		return 0;
	}

	// context is important as it is used in html base plugin for page specific URL
	static _getPosthtmlInstance(callbacks = [], plugins = [], context = {}) {
		let inst = posthtml();

		// already sorted by priority when added
		for (let { fn: plugin, options } of plugins) {
			inst.use(plugin(Object.assign({}, context, options)));
		}

		// Run the built-ins last
		if (callbacks.length > 0) {
			inst.use(
				urls({
					eachURL: (url, attrName, tagName) => {
						for (let { fn: callback } of callbacks) {
							// already sorted by priority when added
							url = callback.call(context, url, { attribute: attrName, tag: tagName });
						}

						return url;
					},
				}),
			);
		}

		return inst;
	}

	_add(extensions, addType, value, options = {}) {
		options = Object.assign(
			{
				priority: 0,
			},
			options,
		);

		let extensionsArray = (extensions || "").split(",");
		for (let ext of extensionsArray) {
			let target = this[addType];
			if (!target[ext]) {
				target[ext] = [];
			}

			target[ext].push({
				// *could* fallback to function name, `value.name`
				name: options.name, // for `remove` and debugging
				fn: value, // callback or plugin
				priority: options.priority, // sorted in descending order
				enabled: options.enabled || (() => true),
				options: options.pluginOptions,
			});

			target[ext].sort(HtmlTransformer.prioritySort);
		}
	}

	addPosthtmlPlugin(extensions, plugin, options = {}) {
		this._add(extensions, "plugins", plugin, options);
	}

	// match can be a plugin function or a filter callback(plugin => true);
	remove(extensions, match) {
		for (let removeType of HtmlTransformer.TYPES) {
			for (let ext of (extensions || "").split(",")) {
				this[removeType][ext] = arrayDelete(this[removeType][ext], match);
			}
		}
	}

	addUrlTransform(extensions, callback, options = {}) {
		this._add(extensions, "callbacks", callback, options);
	}

	setPosthtmlProcessOptions(options) {
		Object.assign(this.posthtmlProcessOptions, options);
	}

	isTransformable(extension, context) {
		return (
			this.getCallbacks(extension, context).length > 0 || this.getPlugins(extension).length > 0
		);
	}

	getCallbacks(extension, context) {
		let callbacks = this.callbacks[extension] || [];
		return callbacks.filter(({ enabled }) => {
			if (!enabled || typeof enabled !== "function") {
				return true;
			}
			return enabled(context);
		});
	}

	getPlugins(extension) {
		let plugins = this.plugins[extension] || [];
		return plugins.filter(({ enabled }) => {
			if (!enabled || typeof enabled !== "function") {
				return true;
			}
			return enabled();
		});
	}

	static async transformStandalone(content, callback, posthtmlProcessOptions = {}) {
		let posthtmlInstance = this._getPosthtmlInstance([
			{
				fn: callback,
				enabled: () => true,
			},
		]);
		let result = await posthtmlInstance.process(content, posthtmlProcessOptions);
		return result.html;
	}

	async transformContent(outputPath, content, context) {
		let extension = FilePathUtil.getFileExtension(outputPath);
		if (!this.isTransformable(extension, context)) {
			return content;
		}

		let bench = this.aggregateBench.get(`Transforming \`${extension}\` with posthtml`);
		bench.before();
		let callbacks = this.getCallbacks(extension, context);
		let plugins = this.getPlugins(extension);
		let posthtmlInstance = HtmlTransformer._getPosthtmlInstance(callbacks, plugins, context);
		let result = await posthtmlInstance.process(content, this.posthtmlProcessOptions);
		bench.after();
		return result.html;
	}
}
