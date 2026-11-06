import { importAsFunction } from "./ImportAsFunction.js";

export async function RetrieveGlobals(code, filePath, options = {}) {
	let { isJavaScriptFrontMatterCompat = false, globals } = options;
	return importAsFunction(code, {
		filePath,
		implicitExports: !isJavaScriptFrontMatterCompat,
		data: {
			...globals,
			page: {
				// Theoretically fileSlug and filePathStem could be added here but require extensionMap
				inputPath: filePath,
			},
		},
	});
}
