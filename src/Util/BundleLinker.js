import debugUtil from "debug";

const debug = debugUtil("Eleventy:BundleLinker");

class BundleLinker {
	#additions = new Map();

	record(key, additions) {
		if (!additions || additions.length === 0) {
			return;
		}
		if (!this.#additions.has(key)) {
			this.#additions.set(key, []);
		}
		for (let addition of additions) {
			this.#additions.get(key).push(addition);
		}
		debug("Recorded %d bundle additions for key %o", additions.length, key);
	}

	replay(key, bundleManager) {
		if (!this.#additions.has(key)) {
			return;
		}
		let additions = this.#additions.get(key);
		debug("Replaying %d bundle additions for key %o", additions.length, key);
		for (let addition of additions) {
			bundleManager.addToBundle(addition.bucket, addition.content, addition.urlOverride);
		}
	}

	has(key) {
		return this.#additions.has(key);
	}

	delete(key) {
		this.#additions.delete(key);
	}

	clear() {
		this.#additions.clear();
	}
}

export { BundleLinker };
