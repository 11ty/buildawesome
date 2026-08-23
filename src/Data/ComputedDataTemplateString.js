import lodash from "@11ty/lodash-custom";

import { createDebug } from "../Util/DebugLogUtil.js";

const { set: lodashSet } = lodash;
const debug = createDebug("ComputedDataTemplateString");

/* Calculates computed data in Template Strings.
 * Ideally we would use the Proxy approach but it doesn’t work
 * in some template languages that visit all available data even if
 * it isn’t used in the template (Nunjucks)
 */
class ComputedDataTemplateString {
	constructor(computedKeys) {
		if (Array.isArray(computedKeys)) {
			this.computedKeys = new Set(computedKeys);
		} else {
			this.computedKeys = computedKeys;
		}

		// is this ¯\_(lisp)_/¯
		// must be strings that won’t be escaped by template languages
		this.prefix = "(((11ty(((";
		this.suffix = ")))11ty)))";
	}

	getProxyData() {
		let proxyData = {};

		// use these special strings as a workaround to check the rendered output
		// can’t use proxies here as some template languages trigger proxy for all
		// keys in data
		for (let key of this.computedKeys) {
			// TODO don’t allow to set eleventyComputed.page? other disallowed computed things?
			lodashSet(proxyData, key, this.prefix + key + this.suffix);
		}

		return proxyData;
	}

	findVarsInOutput(output = "") {
		let vars = new Set();
		let splits = output.split(this.prefix);
		for (let split of splits) {
			let varName = split.slice(0, split.indexOf(this.suffix) < 0 ? 0 : split.indexOf(this.suffix));
			if (varName) {
				vars.add(varName);
			}
		}
		return Array.from(vars);
	}

	async findVarsUsed(fn) {
		let proxyData = this.getProxyData();
		let output;
		// Mitigation for #1061, errors with filters in the first pass shouldn’t fail the whole thing.
		try {
			output = await fn(proxyData);
		} catch (e) {
			debug("Computed Data first pass data resolution error: %o", e);
		}

		// page.outputPath on serverless urls returns false.
		if (typeof output === "string") {
			return this.findVarsInOutput(output);
		}
		return [];
	}
}

export default ComputedDataTemplateString;
