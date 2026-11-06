import lodash from "@11ty/lodash-custom";

import { createDebug } from "../Util/DebugLogUtil.js";

const { set: lodashSet } = lodash;
const debug = createDebug("ComputedDataTemplateString");

/* Finds computed data used in Template Strings by rendering placeholder values.
 * Proxies don’t work here because some template languages (Nunjucks) visit all available data.
 */
class ComputedDataTemplateString {
	// Must be strings that won’t be escaped by template languages
	prefix = "(((11ty(((";
	suffix = ")))11ty)))";

	constructor(computedKeys, unavailable = []) {
		this.computedKeys = new Set(computedKeys);
		this.unavailable = unavailable;
	}

	getProxyData(found = new Set()) {
		let proxyData = {};
		for (let key of this.computedKeys) {
			lodashSet(proxyData, key, this.prefix + key + this.suffix);
		}
		for (let path of this.unavailable) {
			lodashSet(proxyData, path, this.#getRecorder(path, found));
		}
		return proxyData;
	}

	// Any use of an unavailable path (property access or printing) records it.
	#getRecorder(path, found) {
		return new Proxy(
			{},
			{
				get: (target, prop) => {
					found.add(path);
					if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") {
						return () => "";
					}
				},
			},
		);
	}

	findVarsInOutput(output = "") {
		let vars = new Set();
		for (let split of output.split(this.prefix)) {
			let end = split.indexOf(this.suffix);
			if (end > 0) {
				vars.add(split.slice(0, end));
			}
		}
		return Array.from(vars);
	}

	async findVarsUsed(fn) {
		let found = new Set();
		let output;
		// Mitigation for #1061, errors with filters in the first pass shouldn’t fail the whole thing.
		try {
			output = await fn(this.getProxyData(found));
		} catch (e) {
			debug("Computed Data first pass data resolution error: %o", e);
		}

		// e.g. `page.outputPath` can be `false`
		if (typeof output === "string") {
			for (let varUsed of this.findVarsInOutput(output)) {
				found.add(varUsed);
			}
		}
		return Array.from(found);
	}
}

export default ComputedDataTemplateString;
