import { createRequire } from "node:module";

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with#browser_compatibility
import corePackageJson from "../../package.json" with { type: "json" };

// important to clear the require.cache in CJS projects
export { corePackageJson };

const require = createRequire(import.meta.url);

export function clearRequireCache(absolutePath) {
	// ESM Eleventy when using `import()` on a CJS project file still adds to require.cache
	if (absolutePath in (require?.cache || {})) {
		delete require.cache[absolutePath];
	}
}

export function importJsonSync(filePath) {
	if (!filePath || !filePath.endsWith(".json")) {
		throw new Error(`importJsonSync expects a .json file extension (received: ${filePath})`);
	}

	return require(filePath);
}

export function requireCommonJsTypeScript(filePath) {
	return require(filePath);
}
