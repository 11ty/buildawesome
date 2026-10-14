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

	constructor(computedKeys) {
		this.computedKeys = new Set(computedKeys);
	}

	getProxyData() {
		let proxyData = {};
		for (let key of this.computedKeys) {
			lodashSet(proxyData, key, this.prefix + key + this.suffix);
		}
		return proxyData;
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
		let output;
		// Mitigation for #1061, errors with filters in the first pass shouldn’t fail the whole thing.
		try {
			output = await fn(this.getProxyData());
		} catch (e) {
			debug("Computed Data first pass data resolution error: %o", e);
		}

		// e.g. `page.outputPath` can be `false`
		if (typeof output === "string") {
			return this.findVarsInOutput(output);
		}
		return [];
	}
}

export default ComputedDataTemplateString;
