/* A lazily evaluated, memoized computed value that tracks the keys it reads. */
class Signal {
	state = "idle"; // idle, done, deferred
	deps = new Set();

	get isIdle() {
		return this.state === "idle";
	}

	get isDone() {
		return this.state === "done";
	}

	get isDeferred() {
		return this.state === "deferred";
	}

	done() {
		this.state = "done";
	}

	defer() {
		this.state = "deferred";
	}

	reset() {
		this.state = "idle";
		this.deps.clear();
	}
}

/* Signal state for one data object (e.g. one paginated page), keyed by computed data key. */
export default class Signals {
	#signals = new Map();
	// Data paths the current pipeline stage can’t provide yet (e.g. `collections`), anything reading them is deferred.
	unavailable = [];

	constructor(keys = []) {
		for (let key of keys) {
			this.#signals.set(key, new Signal());
		}
	}

	has(key) {
		return this.#signals.has(key);
	}

	get(key) {
		return this.#signals.get(key);
	}

	keys() {
		return this.#signals.keys();
	}

	// Starts from another data object’s resolved signals, e.g. a paginated page from its template.
	inherit(parent) {
		for (let [key, signal] of this.#signals) {
			let parentSignal = parent.get(key);
			if (parentSignal?.isDone) {
				signal.done();
				signal.deps = new Set(parentSignal.deps);
			}
		}
	}

	resetDeferred() {
		for (let signal of this.#signals.values()) {
			if (signal.isDeferred) {
				signal.reset();
			}
		}
	}

	getDependencies(key) {
		return Array.from(this.get(key)?.deps || []);
	}

	isUnavailable(path) {
		return this.unavailable.some((entry) => path === entry || path.startsWith(entry + "."));
	}

	hasUnavailableChild(path) {
		return this.unavailable.some((entry) => entry.startsWith(path + "."));
	}

	// Whether an unresolved key (other than `self`) or an unavailable path lives underneath `path`.
	hasPendingChild(path, self) {
		for (let [key, signal] of this.#signals) {
			if (key !== self && !signal.isDone && key.startsWith(path + ".")) {
				return true;
			}
		}
		return this.hasUnavailableChild(path);
	}

	// Immediate child property names of `path` (top-level when empty) with a signal (other than `self`) or unavailable path.
	getChildNames(path, self) {
		let names = new Set();
		for (let key of [...this.#signals.keys(), ...this.unavailable]) {
			if (key === self || (path && !key.startsWith(path + "."))) {
				continue;
			}
			let name = key.slice(path ? path.length + 1 : 0).split(".")[0];
			if (name) {
				names.add(name);
			}
		}
		return names;
	}
}
