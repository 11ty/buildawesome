import { TemplatePath } from "@11ty/eleventy-utils";
import { DepGraph } from "dependency-graph";
import { mergeGraphs } from "@11ty/dependency-tree-esm";

import JavaScriptDependencies from "./Util/JavaScriptDependencies.js";
import eventBus from "./EventBus.js";

export default class WatchTargets {
	#templateConfig;

	constructor(templateConfig) {
		this.targets = new Set();
		this.dependencies = new Set();
		this.newTargets = new Set();
		this.isEsm = false;

		this.graph = new DepGraph();
		this.#templateConfig = templateConfig;
	}

	setProjectUsingEsm(isEsmProject) {
		this.isEsm = !!isEsmProject;
	}

	isJavaScriptDependency(path) {
		return this.dependencies.has(path);
	}

	reset() {
		this.newTargets = new Set();
	}

	addToDependencyGraph(parent, deps) {
		if (!this.graph.hasNode(parent)) {
			this.graph.addNode(parent);
		}
		for (let dep of deps) {
			if (!this.graph.hasNode(dep)) {
				this.graph.addNode(dep);
			}
			this.graph.addDependency(parent, dep);
		}
	}

	uses(parent, dep) {
		return this.getDependenciesOf(parent).includes(dep);
	}

	getDependenciesOf(parent) {
		if (!this.graph.hasNode(parent)) {
			return [];
		}
		return this.graph.dependenciesOf(parent);
	}

	getDependantsOf(child) {
		if (!this.graph.hasNode(child)) {
			return [];
		}
		return this.graph.dependantsOf(child);
	}

	addRaw(targets, isDependency) {
		for (let target of targets) {
			let path = TemplatePath.addLeadingDotSlash(target);
			if (!this.targets.has(target)) {
				this.newTargets.add(path);
			}

			this.targets.add(path);

			if (isDependency) {
				this.dependencies.add(path);
			}
		}
	}

	static toArray(targets) {
		if (!targets) {
			return [];
		} else if (Array.isArray(targets)) {
			return targets;
		}

		return [targets];
	}

	// add only a target
	add(targets) {
		this.addRaw(WatchTargets.toArray(targets));
	}

	static normalizeToGlobs(targets) {
		return WatchTargets.toArray(targets).map((entry) =>
			TemplatePath.convertToRecursiveGlobSync(entry),
		);
	}

	// add only a target’s dependencies
	async addDependencies(targets, filterCallback) {
		if (this.#templateConfig && !this.#templateConfig.shouldSpiderJavaScriptDependencies()) {
			return;
		}

		targets = WatchTargets.toArray(targets);
		let cjsDeps = Array.from(
			await JavaScriptDependencies.getCommonJsDependencies(targets, this.isEsm),
		);
		if (filterCallback) {
			cjsDeps = cjsDeps.filter(filterCallback);
		}
		for (let target of targets) {
			this.addToDependencyGraph(target, cjsDeps);
		}
		this.addRaw(cjsDeps, true);

		// https://github.com/11ty/eleventy/issues/3899
		// Note that this fix is ESM-only, dependency-tree CJS doesn’t support returning graphs (yet?)
		let esmGraph = await JavaScriptDependencies.getEsmGraph(targets, this.isEsm);
		if (filterCallback) {
			for (let node of esmGraph.overallOrder()) {
				if (!filterCallback(node)) {
					esmGraph.removeNode(node);
				}
			}
		}

		mergeGraphs(this.graph, esmGraph);

		// ESM graph includes original targets, which we do not want for addRaw so we’ll remove them before adding
		let rawEsmGraph = esmGraph.clone();
		for (let t of targets) {
			rawEsmGraph.removeNode(t);
		}
		this.addRaw(rawEsmGraph.overallOrder(), true);
	}

	setWriter(templateWriter) {
		this.writer = templateWriter;
	}

	clearImportCacheFor(filePathArray) {
		let paths = new Set();
		for (const filePath of filePathArray) {
			paths.add(filePath);

			// Delete from require cache so that updates to the module are re-required
			let importsTheChangedFile = this.getDependantsOf(filePath);
			for (let dep of importsTheChangedFile) {
				paths.add(dep);
			}

			let isImportedInTheChangedFile = this.getDependenciesOf(filePath);
			for (let dep of isImportedInTheChangedFile) {
				paths.add(dep);
			}

			// Use GlobalDependencyMap
			let dependantsMapped = this.#templateConfig?.usesGraph.getDependantsFor(filePath) || [];
			for (let dep of dependantsMapped) {
				paths.add(dep);
			}
		}

		eventBus.emit("buildawesome.importcachereset", paths);
	}

	getNewTargetsSinceLastReset() {
		return Array.from(this.newTargets);
	}

	getTargets() {
		return Array.from(this.targets);
	}
}
