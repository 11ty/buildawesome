import { LoadContent } from "./Require.js";
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with#browser_compatibility
import corePackageJson from "../../package.json" with { type: "json" };

// We *could* prune everything but `name`, `version`, and `type` here but esbuild will still bundle the entire package.json
export { corePackageJson };

// noop
export function clearRequireCache() {}

// Stub for workaround for https://github.com/nodejs/node/issues/61385
export function requireCommonJsTypeScript() {
	throw new Error("TypeScript is not supported in this bundle of Eleventy.");
}

export function importJsonSync(path) {
	// should not be a no-op
	let rawInput = LoadContent(path);
	if (!rawInput) {
		// should not error when file exists but is _empty_
		return;
	}
	return JSON.parse(rawInput);
}
