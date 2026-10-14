import { existsSync, readFileSync } from "node:fs";
import { importFromString } from "import-module-string";

import { fileURLToPath } from "../Adapters/Packages/url.js";
import { LoadContent } from "./Require.js";

export default function importer(relPath) {
	let filePath = fileURLToPath(relPath);

	// `import-module-string` can now `import()` so we avoid needing to esbuild these
	let code = LoadContent(filePath);
	return importFromString(code, {
		implicitExports: false,
		filePath,
		resolveImportContent: function (modInfo = {}) {
			if (modInfo.mode !== "relative") {
				return;
			}

			if (!existsSync(modInfo.path)) {
				throw new Error("Could not find content for module: " + JSON.stringify(modInfo));
			}

			return readFileSync(modInfo.path, "utf8");
		},
	});

	// import { parseCode, walkCode, importFromString } from "import-module-string";
	// Alternative approach saved for posterity (and could be used to warn about modules needing to be Import Mapped):
	// 	let ast = parseCode(code);
	// 	let { imports } = walkCode(ast);
	// 	if(imports.size === 0) {
	// 		return importFromString(code, { ast, filePath });
	// 	}
	// 	// This file needs to be esbuild-ed
	// 	return import(filePath);
	// }
}
