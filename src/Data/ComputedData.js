import lodash from "@11ty/lodash-custom";

import { createDebug } from "../Util/DebugLogUtil.js";
import ComputedDataTemplateString from "./ComputedDataTemplateString.js";
import Signals from "./Signals.js";

const { set: lodashSet } = lodash;
const debug = createDebug("ComputedData");

// Thrown from a data read that can’t resolve yet: a pending computed key or an unavailable path.
class InterruptedRead {
	constructor(path) {
		this.path = path;
	}
}

export class ComputedDataCycleError extends Error {}

/* Computed data as a graph of signals: each key is resolved on demand when first read. */
export default class ComputedData {
	// key => { value, declaredDependencies, symbolParseFn, isTemplateString }
	#entries = new Map();
	// data => Signals, state is per data object (e.g. per paginated page)
	#signals = new WeakMap();
	// tracking proxy => original object
	#proxyTargets = new WeakMap();

	constructor(config) {
		this.config = config;
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

	#getSignals(data) {
		let signals = this.#signals.get(data);
		if (!signals) {
			signals = new Signals(this.#entries.keys());
			this.#signals.set(data, signals);
		}
		return signals;
	}

	// Resolves what it can (of `keys`, default all), deferring anything that reads an `unavailable` path (retried on the next call).
	async setupData(data, { unavailable = [], keys = this.#entries.keys() } = {}) {
		let signals = this.#getSignals(data);
		signals.resetDeferred();
		signals.unavailable = unavailable;

		for (let key of keys) {
			await this.#pull(key, data, signals, []);
		}
	}

	async processRemainingData(data) {
		await this.setupData(data);
	}

	// Reuses signals already resolved for `parentData` by `parent`, e.g. a paginated page reusing its template’s.
	inherit(data, parent, parentData) {
		let parentSignals = parent.#signals.get(parentData);
		if (parentSignals) {
			this.#getSignals(data).inherit(parentSignals);
		}
	}

	// The first deferred computed key overlapping `path` (and the unavailable path that deferred it).
	getDeferred(path, data) {
		let signals = this.#signals.get(data);
		for (let key of this.#entries.keys()) {
			let signal = signals?.get(key);
			if (
				signal?.isDeferred &&
				(key === path || key.startsWith(path + ".") || path.startsWith(key + "."))
			) {
				return { key, reason: signal.reason };
			}
		}
	}

	// Keys a computed entry was observed reading.
	getDependencies(key, data) {
		return this.#signals.get(data)?.getDependencies(key) || [];
	}

	async #pull(key, data, signals, stack) {
		let signal = signals.get(key);
		if (!signal.isIdle) {
			return;
		}

		if (stack.includes(key)) {
			throw new ComputedDataCycleError(
				`Circular computed data dependency: ${[...stack, key].join(" -> ")}`,
			);
		}

		let entry = this.#entries.get(key);
		let childStack = [...stack, key];

		if (signals.isUnavailable(key)) {
			signal.defer(key);
			return;
		}

		let result = entry.value;
		if (typeof entry.value === "function") {
			let run = entry.isTemplateString ? this.#runTemplateString : this.#runFunction;
			result = await run.call(this, key, entry, data, signals, childStack);
		}

		if (signal.isDeferred) {
			debug("Deferred %o until its data is available", key);
			return;
		}

		lodashSet(data, key, result);
		signal.done();
	}

	// Resolves `dep` for `key`, returns false (and defers `key`) if it can’t resolve yet.
	async #pullDependency(key, dep, data, signals, stack) {
		let signal = signals.get(key);
		signal.deps.add(dep);
		await this.#pull(dep, data, signals, stack);

		if (signals.get(dep).isDeferred) {
			signal.defer(signals.get(dep).reason);
			return false;
		}
		return true;
	}

	// Resolves every computed key overlapping the variable paths in `varsUsed`.
	async #pullVars(key, varsUsed, data, signals, stack) {
		for (let varUsed of varsUsed) {
			if (signals.isUnavailable(varUsed) || signals.hasUnavailableChild(varUsed)) {
				signals.get(key).defer(varUsed);
				return false;
			}

			for (let dep of this.#entries.keys()) {
				if (
					dep !== key &&
					(dep === varUsed || dep.startsWith(varUsed + ".") || varUsed.startsWith(dep + "."))
				) {
					if (!(await this.#pullDependency(key, dep, data, signals, stack))) {
						return false;
					}
				}
			}
		}
		return true;
	}

	// Template engines read data synchronously, so dependencies resolve before rendering.
	async #runTemplateString(key, entry, data, signals, stack) {
		let { value, declaredDependencies, symbolParseFn } = entry;

		let varsUsed;
		if (symbolParseFn) {
			varsUsed = symbolParseFn();
		} else {
			varsUsed = await new ComputedDataTemplateString(
				this.#entries.keys(),
				signals.unavailable,
			).findVarsUsed(value);
		}

		debug("%o accesses %o variables", key, varsUsed);

		if (await this.#pullVars(key, [...declaredDependencies, ...varsUsed], data, signals, stack)) {
			return value(data);
		}
	}

	// Functions read through a tracking proxy and re-run after each unresolved computed key they hit.
	async #runFunction(key, entry, data, signals, stack) {
		let { value, declaredDependencies } = entry;

		if (!(await this.#pullVars(key, declaredDependencies, data, signals, stack))) {
			return;
		}

		while (true) {
			let context = { key, signals, pending: undefined, unavailable: undefined };
			let result;
			let error;

			try {
				result = await value(this.#getTrackingProxy(data, context));
			} catch (e) {
				error = e;
			}

			// Checked before `error` so a swallowed InterruptedRead still defers or re-runs.
			if (context.unavailable) {
				signals.get(key).defer(context.unavailable);
				return;
			}

			if (context.pending) {
				if (!(await this.#pullDependency(key, context.pending, data, signals, stack))) {
					return;
				}
				continue;
			}

			if (error) {
				throw error;
			}

			// Returned objects (e.g. `data => data.page`) must not leak the tracking proxy
			if (this.#proxyTargets.has(result)) {
				result = this.#proxyTargets.get(result);
			}

			return result;
		}
	}

	// Empty target avoids Proxy invariant errors on frozen data.
	#getTrackingProxy(target, context, parentPath = "") {
		let get = (prop) => {
			if (typeof prop !== "string") {
				return target[prop];
			}

			let path = parentPath ? `${parentPath}.${prop}` : prop;

			if (context.signals.isUnavailable(path)) {
				context.unavailable ??= path;
				throw new InterruptedRead(path);
			}

			let signal = context.signals.get(path);
			if (signal && path !== context.key) {
				context.signals.get(context.key).deps.add(path);
				if (!signal.isDone) {
					context.pending ??= path;
					throw new InterruptedRead(path);
				}
			}

			let value = target[prop];
			if (context.signals.hasPendingChild(path, context.key)) {
				// e.g. reading `page` before `page.url` is set
				return this.#getTrackingProxy(
					value && typeof value === "object" ? value : {},
					context,
					path,
				);
			}

			return value;
		};

		let proxy = new Proxy(
			{},
			{
				get: (obj, prop) => get(prop),
				has: (obj, prop) => prop in target,
				// Includes unset computed children so enumeration (e.g. JSON.stringify) reads them
				ownKeys: () => {
					let keys = new Set(Reflect.ownKeys(target));
					for (let name of context.signals.getChildNames(parentPath, context.key)) {
						keys.add(name);
					}
					return Array.from(keys);
				},
				getOwnPropertyDescriptor: (obj, prop) => {
					let descriptor = Reflect.getOwnPropertyDescriptor(target, prop) ?? {
						writable: true,
						enumerable: true,
					};
					if (!descriptor.get && !descriptor.set) {
						descriptor.value = get(prop);
					}
					// Must be configurable because it doesn’t exist on the Proxy target
					descriptor.configurable = true;
					return descriptor;
				},
			},
		);

		this.#proxyTargets.set(proxy, target);
		return proxy;
	}
}
