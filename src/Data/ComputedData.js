import lodash from "@11ty/lodash-custom";

import { createDebug } from "../Util/DebugLogUtil.js";
import ComputedDataQueue from "./ComputedDataQueue.js";
import ComputedDataTemplateString from "./ComputedDataTemplateString.js";
import ComputedDataProxy from "./ComputedDataProxy.js";

const { set: lodashSet } = lodash;
const debug = createDebug("ComputedData");

class ComputedData {
	// key => { value, declaredDependencies, symbolParseFn, isTemplateString }
	#entries = new Map();

	constructor(config) {
		this.config = config;
		this.queue = new ComputedDataQueue();
	}

	get computedKeys() {
		return new Set(this.#entries.keys());
	}

	add(
		key,
		value,
		declaredDependencies = [],
		symbolParseFn,
		templateInstance,
		isTemplateString = false,
	) {
		if (typeof value === "function") {
			// TODO bug? no access to non-universal config things?
			value = value.bind({
				...this.config?.javascriptFunctions,
				tmpl: templateInstance,
			});
		}

		this.#entries.set(key, { value, declaredDependencies, symbolParseFn, isTemplateString });
	}

	addTemplateString(key, value, declaredDependencies = [], symbolParseFn, templateInstance) {
		this.add(key, value, declaredDependencies, symbolParseFn, templateInstance, true);
	}

	async #findVarsUsed(entry, data, resolvers) {
		let { value, symbolParseFn, isTemplateString } = entry;

		if (symbolParseFn) {
			// use the parseForSymbols function in the TemplateEngine
			return symbolParseFn();
		}

		let resolver = isTemplateString ? resolvers.templateString : resolvers.proxy;
		return resolver.findVarsUsed(value, data);
	}

	async resolveVarOrder(data) {
		let computedKeys = this.computedKeys;
		let resolvers = {
			templateString: new ComputedDataTemplateString(computedKeys),
			proxy: new ComputedDataProxy(computedKeys),
		};

		for (let [key, entry] of this.#entries) {
			// Non-function values (booleans, numbers, etc.) have no dependencies
			if (typeof entry.value !== "function") {
				this.queue.addNode(key);
				continue;
			}

			let varsUsed = await this.#findVarsUsed(entry, data, resolvers);
			debug("%o accesses %o variables", key, varsUsed);

			this.queue.uses(key, [
				...entry.declaredDependencies,
				...varsUsed.filter(
					(varUsed) =>
						(varUsed !== key && computedKeys.has(varUsed)) || varUsed.startsWith("collections."),
				),
			]);
		}
	}

	async setupData(data, orderFilter) {
		await this.resolveVarOrder(data);
		await this.processRemainingData(data, orderFilter);
	}

	async processRemainingData(data, orderFilter) {
		let order = this.queue.getOrder();
		if (typeof orderFilter === "function") {
			order = order.filter(orderFilter.bind(this.queue));
		}

		debug("Computed data order of execution: %o", order);

		for (let key of order) {
			// Graph may include non-computed nodes (e.g. `collections.*`)
			let entry = this.#entries.get(key);
			if (!entry) {
				continue;
			}

			let { value } = entry;
			lodashSet(data, key, typeof value === "function" ? await value(data) : value);
		}

		this.queue.markComputed(order);
	}
}

export default ComputedData;
