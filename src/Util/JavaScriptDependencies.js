import { find, findGraph, mergeGraphs } from "@11ty/dependency-tree";
import { TemplatePath } from "@11ty/eleventy-utils";
import { DepGraph } from "dependency-graph";

import BaseError from "../Errors/BaseError.js";

// ES modules, CommonJS, and TypeScript (with JSX)
const EXTENSIONS = new Set(["js", "cjs", "mjs", "jsx", "ts", "cts", "mts", "tsx"]);

class JavaScriptDependencies {
	static getErrorMessage(file) {
		return `A problem was encountered looking for JavaScript dependencies in file: ${file}. This only affects --watch and --serve behavior and does not affect your build.`;
	}

	static #getJavaScriptFiles(inputFiles) {
		return inputFiles.filter((file) => EXTENSIONS.has(TemplatePath.getExtension(file)));
	}

	static async getDependencies(inputFiles) {
		let deps = new Set();
		for (let file of this.#getJavaScriptFiles(inputFiles)) {
			try {
				for (let dep of await find(file)) {
					deps.add(dep);
				}
			} catch (e) {
				throw new BaseError(this.getErrorMessage(file), e);
			}
		}

		return Array.from(deps);
	}

	// Includes the input files
	static async getGraph(inputFiles) {
		let rootGraph = new DepGraph();
		for (let file of this.#getJavaScriptFiles(inputFiles)) {
			try {
				mergeGraphs(rootGraph, await findGraph(file));
			} catch (e) {
				throw new BaseError(this.getErrorMessage(file), e);
			}
		}

		return rootGraph;
	}
}

export default JavaScriptDependencies;
