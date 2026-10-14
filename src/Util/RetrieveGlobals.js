import { parseCode, walkCode, importFromString } from "import-module-string";
import { isBuiltin } from "node:module";

export async function RetrieveGlobals(code, filePath, options = {}) {
	let { isJavaScriptFrontMatterCompat } = Object.assign(
		{ isJavaScriptFrontMatterCompat: false },
		options,
	);
	let data = {
		page: {
			// Theoretically fileSlug and filePathStem could be added here but require extensionMap
			inputPath: filePath,
		},
	};

	let implicitExports = isJavaScriptFrontMatterCompat ? false : true;
	return importFromString(code, { data, filePath, implicitExports });
}
