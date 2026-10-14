import { importFromString } from "import-module-string";

export async function RetrieveGlobals(code, filePath) {
	let data = {
		page: {
			// Theoretically fileSlug and filePathStem could be added here but require extensionMap
			inputPath: filePath,
		},
	};

	// Do *not* error when imports are found because they might be mapped via an Import Map.
	return importFromString(code, { data, filePath });
}
