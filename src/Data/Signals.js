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
	// Skips anything that reads collections (they aren’t built yet).
	deferCollections = false;

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

	// Whether an unresolved key (other than `self`) lives underneath `path`.
	hasUnresolvedChild(path, self) {
		for (let [key, signal] of this.#signals) {
			if (key !== self && !signal.isDone && key.startsWith(path + ".")) {
				return true;
			}
		}
		return false;
	}

	// Immediate child property names of `path` (top-level when empty) that have a signal, other than `self`.
	getChildNames(path, self) {
		let names = new Set();
		for (let key of this.#signals.keys()) {
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
