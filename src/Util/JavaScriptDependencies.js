import dependencyTree from "@11ty/dependency-tree";
import { find, findGraph, mergeGraphs } from "@11ty/dependency-tree-esm";
import {
	find as findTypeScript,
	findGraph as findTypeScriptGraph,
} from "@11ty/dependency-tree-typescript";
import { TemplatePath } from "@11ty/eleventy-utils";
import { DepGraph } from "dependency-graph";

import { union } from "./SetUtil.js";
import BaseError from "../Errors/BaseError.js";

class JavaScriptDependencies {
	static getErrorMessage(file, type) {
		return `A problem was encountered looking for JavaScript dependencies in ${type} file: ${file}. This only affects --watch and --serve behavior and does not affect your build.`;
	}

	static getFlavor(filePath, isProjectUsingEsm) {
		if (
			(isProjectUsingEsm && (filePath.endsWith(".js") || filePath.endsWith(".ts"))) ||
			filePath.endsWith(".mjs") ||
			filePath.endsWith(".mts")
		) {
			return "esm";
		}
		if (
			(!isProjectUsingEsm && (filePath.endsWith(".js") || filePath.endsWith(".ts"))) ||
			filePath.endsWith(".cjs") ||
			filePath.endsWith(".cts")
		) {
			return "cjs";
		}
	}

	static isTypeScript(filePath) {
		return filePath.endsWith(".ts") || filePath.endsWith(".cts") || filePath.endsWith(".mts");
	}

	static async getCommonJsDependencies(inputFiles, isProjectUsingEsm) {
		let depSet = new Set();

		// TODO does this need to work with aliasing? what other JS extensions will have deps?
		let commonJsFiles = inputFiles.filter(
			(file) => this.getFlavor(file, isProjectUsingEsm) === "cjs",
		);

		// TODO require(esm) means some files *could* be wrong here
		for (let file of commonJsFiles) {
			try {
				let modules = dependencyTree(file, {
					nodeModuleNames: "exclude",
					allowNotFound: true,
				}).map((dependency) => {
					return TemplatePath.addLeadingDotSlash(TemplatePath.relativePath(dependency));
				});

				for (let dep of modules) {
					depSet.add(dep);
				}
			} catch (e) {
				throw new BaseError(this.getErrorMessage(file, "CommonJS"), e);
			}
		}

		return depSet;
	}

	static async getEsmDependencies(inputFiles, isProjectUsingEsm) {
		let depSet = new Set();

		let esmFiles = inputFiles.filter((file) => this.getFlavor(file, isProjectUsingEsm) === "esm");
		for (let file of esmFiles) {
			try {
				// TODO feature test for node:module->stripTypeScriptTypes and use with find(file, { preprocess })
				let modules = await (this.isTypeScript(file) ? findTypeScript : find)(file);
				for (let dep of modules) {
					depSet.add(dep);
				}
			} catch (e) {
				throw new BaseError(this.getErrorMessage(file, "ESM"), e);
			}
		}

		return depSet;
	}

	static async getDependencies(inputFiles, isProjectUsingEsm) {
		let cjs = await this.getCommonJsDependencies(inputFiles, isProjectUsingEsm);
		let esm = await this.getEsmDependencies(inputFiles, isProjectUsingEsm);
		return Array.from(union(cjs, esm));
	}

	static async getEsmGraph(inputFiles, isProjectUsingEsm) {
		let rootGraph = new DepGraph();
		let esmFiles = inputFiles.filter((file) => this.getFlavor(file, isProjectUsingEsm) === "esm");
		for (let file of esmFiles) {
			try {
				// TODO feature test for node:module->stripTypeScriptTypes and use with find(file, { preprocess })
				let graph = await (this.isTypeScript(file) ? findTypeScriptGraph : findGraph)(file);

				mergeGraphs(rootGraph, graph);
			} catch (e) {
				throw new BaseError(this.getErrorMessage(file, "ESM"), e);
			}
		}

		return rootGraph;
	}
}

export default JavaScriptDependencies;
