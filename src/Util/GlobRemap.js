import path from "node:path";
import ProjectDirectories from "./ProjectDirectories.js";
import PathNormalizer from "./PathNormalizer.js";

// even on Windows (in cmd.exe) these paths are normalized to forward slashes
// tinyglobby expects forward slashes on Windows
const SEP = "/";

class GlobRemap {
	constructor(paths = []) {
		this.paths = paths;
		this.cwd = GlobRemap.getCwd(paths);
	}

	getCwd() {
		return this.cwd;
	}

	getRemapped(paths) {
		return paths.map((entry) => GlobRemap.remapInput(entry, this.cwd));
	}

	getInput() {
		return this.getRemapped(this.paths);
	}

	getOutput(paths = []) {
		return paths.map((entry) => GlobRemap.remapOutput(entry, this.cwd));
	}

	static getParentDirPrefix(filePath = "") {
		let count = [];
		for (let p of filePath.split(SEP)) {
			if (p === "..") {
				count.push("..");
			} else {
				break;
			}
		}

		if (count.length > 0) {
			// trailing slash
			return count.join(SEP) + SEP;
		}
		return "";
	}

	static getLongestParentDirPrefix(filePaths) {
		let longest = "";
		filePaths
			.map((entry) => {
				return this.getParentDirPrefix(entry);
			})
			.filter((entry) => Boolean(entry))
			.forEach((prefix) => {
				if (!longest || prefix.length > longest.length) {
					longest = prefix;
				}
			});
		return longest;
	}

	// alias
	static getCwd(filePaths) {
		return this.getLongestParentDirPrefix(filePaths);
	}

	static remapInput(entry, cwd) {
		if (cwd) {
			if (!entry.startsWith("**" + SEP) && !entry.startsWith(`.git${SEP}**`)) {
				return PathNormalizer.normalizeSeperator(ProjectDirectories.getRelativeTo(entry, cwd));
			}
		}
		return entry;
	}

	static remapOutput(entry, cwd) {
		if (cwd) {
			return PathNormalizer.normalizeSeperator(path.join(cwd, entry));
		}
		return entry;
	}
}

export default GlobRemap;
