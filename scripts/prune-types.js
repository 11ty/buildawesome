import { readFileSync, readdirSync, rmSync } from "node:fs";
import { parse, join } from "node:path";
import { glob } from "tinyglobby";
import { importFromString } from "import-module-string";

const TYPES_DIR = "./types";

// JSON with comments
const TSCONFIG_CONTENT = readFileSync("./tsconfig.json", "utf8");
const { default: TSCONFIG } = await importFromString(`export default ${TSCONFIG_CONTENT}`);

const allowedSourceFiles = new Set(TSCONFIG.include);
console.log("Allowed sources:", TSCONFIG.include);

const eligible = await glob(["types/**/*.d.{ts,cts,mts}"]);
const deletedFiles = new Set();
for (let typeFile of eligible) {
	let srcFile = typeFile.replace("types/", "src/");
	srcFile = srcFile.replace(".d.ts", ".js");

	if (!allowedSourceFiles.has(srcFile)) {
		deletedFiles.add(typeFile);
		rmSync(typeFile);
	} else {
		console.log("Keeping", typeFile);
	}
}

// Prune empty directories
const directories = await glob(["types/**"], { onlyDirectories: true });
const deletedDirs = new Set();
for (let dirPath of directories) {
	let [typesDir, ...folderNames] = dirPath.split("/").filter(Boolean);

	for (let j = folderNames.length; j > 0; j--) {
		let subdirPath = join(typesDir, ...folderNames.slice(0, j));
		if (readdirSync(subdirPath).length === 0) {
			deletedDirs.add(subdirPath);
			rmSync(subdirPath, { recursive: true });
		}
	}
}

console.log("Pruned (files):", deletedFiles.size);
console.log("Pruned (empty dirs):", deletedDirs.size);
