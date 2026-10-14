import { TemplatePath } from "@11ty/eleventy-utils";
import { DepGraph } from "dependency-graph";
import { mergeGraphs } from "@11ty/dependency-tree";

import JavaScriptDependencies from "./Util/JavaScriptDependencies.js";
import eventBus from "./EventBus.js";

export default class WatchTargets {
	#templateConfig;

	constructor(templateConfig) {
		this.targets = new Set();
		this.dependencies = new Set();
		this.newTargets = new Set();

		this.graph = new DepGraph();
		this.#templateConfig = templateConfig;
	}

	isJavaScriptDependency(path) {
		return this.dependencies.has(path);
	}

	reset() {
		this.newTargets = new Set();
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

		// https://github.com/11ty/eleventy/issues/3899
		let graph = await JavaScriptDependencies.getGraph(targets);

		// The filter only applies to new watch targets: dependants of a changed file (e.g. global data files) must be in the graph to reset their import cache
		mergeGraphs(this.graph, graph);

		// The graph includes the original targets, which we do not want for addRaw
		let targetSet = new Set(targets);
		this.addRaw(
			graph
				.overallOrder()
				.filter((node) => !targetSet.has(node) && (!filterCallback || filterCallback(node))),
			true,
		);
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
