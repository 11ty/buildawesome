import { isTypeScriptSupported } from "./TypeScriptFeatureTest.cjs";

// the order here is important
const ELIGIBLE_EXTENSIONS = [
	"js",
	"mjs",
	"cjs",
	...(isTypeScriptSupported() ? ["ts", "mts", "cts"] : []),
];

export class FilePathUtil {
	static isMatchingExtension(filepath, fileExtension) {
		if (!fileExtension) {
			return false;
		}

		if (!(fileExtension || "").startsWith(".")) {
			fileExtension = "." + fileExtension;
		}

		return filepath.endsWith(fileExtension);
	}

	static getFileExtension(filepath) {
		return (filepath || "").split(".").pop();
	}
}

export function isEligibleJavaScriptFileExtension(ext) {
	return ELIGIBLE_EXTENSIONS.includes((ext || "").toLowerCase());
}

// used for Config Paths (not yet for template data)
export function expandEligibleJavaScriptFilePaths(fileslug) {
	let results = [];
	for (let ext of ELIGIBLE_EXTENSIONS) {
		results.push(`${fileslug}.${ext}`);
	}
	return results;
}
