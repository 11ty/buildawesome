import { parse, sep } from "node:path";
import { TemplatePath } from "@11ty/eleventy-utils";
import { fileURLToPath } from "../Adapters/Packages/url.js";

export default class PathNormalizer {
	static getParts(inputPath) {
		if (!inputPath) {
			return [];
		}

		let separator = "/";
		if (inputPath.includes(sep)) {
			separator = sep;
		}

		return inputPath.split(separator).filter((entry) => entry !== ".");
	}

	// order is important here: the top-most directory returns first
	// array of file and all parent directories
	static getAllPaths(inputPath) {
		let parts = this.getParts(inputPath);
		let allPaths = [];

		let fullpath = "";
		for (let part of parts) {
			fullpath += (fullpath.length > 0 ? "/" : "") + part;
			allPaths.push(fullpath);
		}

		return allPaths;
	}

	static normalizeSeperator(inputPath) {
		if (!inputPath) {
			return inputPath;
		}
		return inputPath.split(sep).join("/");
	}

	static addTrailingSlashToDirectory(dir) {
		if (dir.endsWith("/")) {
			return dir;
		}

		return dir + "/";
	}

	// returns a path
	static getDirectoryFromFilePath(filePath) {
		let parsed = parse(filePath);
		return this.addTrailingSlashToDirectory(parsed.dir);
	}

	// Hot path for the dependency graph, which normalizes every node on every build
	static #fullNormalizationCache = new Map();

	static fullNormalization(inputPath) {
		if (typeof inputPath !== "string") {
			return inputPath;
		}

		let cached = this.#fullNormalizationCache.get(inputPath);
		if (cached !== undefined) {
			return cached;
		}

		let normalized = inputPath;
		// Fix file:///Users/ or file:///C:/ paths passed in
		if (normalized.startsWith("file://")) {
			normalized = fileURLToPath(normalized);
		}

		// Paths should not be absolute (we convert absolute paths to relative)
		// Paths should not have a leading dot slash
		// Paths should always be `/` independent of OS path separator
		normalized = TemplatePath.stripLeadingDotSlash(
			this.normalizeSeperator(TemplatePath.relativePath(normalized)),
		);
		this.#fullNormalizationCache.set(inputPath, normalized);
		return normalized;
	}
}
