import lodash from "@11ty/lodash-custom";

import { createDebug } from "../Util/DebugLogUtil.js";
import ComputedDataQueue from "./ComputedDataQueue.js";
import ComputedDataTemplateString from "./ComputedDataTemplateString.js";
import ComputedDataProxy from "./ComputedDataProxy.js";

const { set: lodashSet, get: lodashGet } = lodash;
const debug = createDebug("ComputedData");

class ComputedData {
	constructor(config) {
		this.computed = {};
		this.symbolParseFunctions = {};
		this.templateStringKeyLookup = {};
		this.computedKeys = new Set();
		this.declaredDependencies = {};
		this.queue = new ComputedDataQueue();
		this.config = config;
	}

	add(key, renderFn, declaredDependencies = [], symbolParseFn, templateInstance) {
		this.computedKeys.add(key);
		this.declaredDependencies[key] = declaredDependencies;

		// bind config filters/JS functions
		if (typeof renderFn === "function") {
			let fns = {};
			// TODO bug? no access to non-universal config things?
			if (this.config) {
				fns = {
					...this.config.javascriptFunctions,
				};
			}
			fns.tmpl = templateInstance;

			renderFn = renderFn.bind(fns);
		}

		lodashSet(this.computed, key, renderFn);

		if (symbolParseFn) {
			lodashSet(this.symbolParseFunctions, key, symbolParseFn);
		}
	}

	addTemplateString(key, renderFn, declaredDependencies = [], symbolParseFn, templateInstance) {
		this.add(key, renderFn, declaredDependencies, symbolParseFn, templateInstance);
		this.templateStringKeyLookup[key] = true;
	}

	async resolveVarOrder(data) {
		let proxyByTemplateString = new ComputedDataTemplateString(this.computedKeys);
		let proxyByProxy = new ComputedDataProxy(this.computedKeys);

		for (let key of this.computedKeys) {
			let computed = lodashGet(this.computed, key);

			if (typeof computed !== "function") {
				// add nodes for non functions (primitives like booleans, etc)
				// This will not handle template strings, as they are normalized to functions
				this.queue.addNode(key);
			} else {
				this.queue.uses(key, this.declaredDependencies[key]);

				let symbolParseFn = lodashGet(this.symbolParseFunctions, key);
				let varsUsed = [];
				if (symbolParseFn) {
					// use the parseForSymbols function in the TemplateEngine
					varsUsed = symbolParseFn();
				} else if (symbolParseFn !== false) {
					// skip resolution is this is false (just use declaredDependencies)
					let isTemplateString = !!this.templateStringKeyLookup[key];
					let proxy = isTemplateString ? proxyByTemplateString : proxyByProxy;
					varsUsed = await proxy.findVarsUsed(computed, data);
				}

				debug("%o accesses %o variables", key, varsUsed);
				let filteredVarsUsed = varsUsed.filter((varUsed) => {
					return (
						(varUsed !== key && this.computedKeys.has(varUsed)) ||
						varUsed.startsWith("collections.")
					);
				});
				this.queue.uses(key, filteredVarsUsed);
			}
		}
	}

	async _setupDataEntry(data, order) {
		debug("Computed data order of execution: %o", order);
		for (let key of order) {
			let computed = lodashGet(this.computed, key);

			if (typeof computed === "function") {
				let ret = await computed(data);
				lodashSet(data, key, ret);
			} else if (computed !== undefined) {
				lodashSet(data, key, computed);
			}
		}
	}

	async setupData(data, orderFilter) {
		await this.resolveVarOrder(data);

		await this.processRemainingData(data, orderFilter);
	}

	async processRemainingData(data, orderFilter) {
		// process all variables
		let order = this.queue.getOrder();
		if (orderFilter && typeof orderFilter === "function") {
			order = order.filter(orderFilter.bind(this.queue));
		}

		await this._setupDataEntry(data, order);
		this.queue.markComputed(order);
	}
}

export default ComputedData;
