import { TemplatePath } from "@11ty/eleventy-utils";

import { createDebug } from "./Util/DebugLogUtil.js";
import JavaScriptDependencies from "./Util/JavaScriptDependencies.js";
import PathNormalizer from "./Util/PathNormalizer.js";
import { TemplateDepGraph } from "./Util/TemplateDepGraph.js";

const debug = createDebug("Dependencies");

class GlobalDependencyMap {
	// dependency-graph requires these keys to be alphabetic strings
	static LAYOUT_KEY = "layout";
	static COLLECTION_PREFIX = "__collection:"; // must match TemplateDepGraph key

	#map;
	#templateConfig;
	#cachedUserConfigurationCollectionApiNames;

	static isCollection(entry) {
		return entry.startsWith(this.COLLECTION_PREFIX);
	}

	static getTagName(entry) {
		if (this.isCollection(entry)) {
			return entry.slice(this.COLLECTION_PREFIX.length);
		}
	}

	static getCollectionKeyForEntry(entry) {
		return `${GlobalDependencyMap.COLLECTION_PREFIX}${entry}`;
	}

	reset() {
		this.#map = undefined;
	}

	setIsEsm(isEsm) {
		this.isEsm = isEsm;
	}

	setTemplateConfig(templateConfig) {
		this.#templateConfig = templateConfig;

		// These have leading dot slashes, but so do the paths from Eleventy
		this.#templateConfig.userConfig.events.once("eleventy.layouts", async (layouts) => {
			await this.addLayoutsToMap(layouts);
		});
	}

	get userConfigurationCollectionApiNames() {
		if (this.#cachedUserConfigurationCollectionApiNames) {
			return this.#cachedUserConfigurationCollectionApiNames;
		}
		return Object.keys(this.#templateConfig.userConfig.getCollections()) || [];
	}

	initializeUserConfigurationApiCollections() {
		this.addCollectionApiNames(this.userConfigurationCollectionApiNames);
	}

	// For Testing
	setCollectionApiNames(names = []) {
		this.#cachedUserConfigurationCollectionApiNames = names;
	}

	addCollectionApiNames(names = []) {
		if (!names || names.length === 0) {
			return;
		}

		for (let collectionName of names) {
			this.map.addConfigCollectionName(collectionName);
		}
	}

	filterOutLayouts(nodes = []) {
		return nodes.filter((node) => {
			if (GlobalDependencyMap.isLayoutNode(this.map, node)) {
				return false;
			}
			return true;
		});
	}

	filterOutCollections(nodes = []) {
		return nodes.filter((node) => !node.startsWith(GlobalDependencyMap.COLLECTION_PREFIX));
	}

	static removeLayoutNodes(graph, nodeList) {
		return nodeList.filter((node) => {
			if (this.isLayoutNode(graph, node)) {
				return false;
			}
			return true;
		});
	}

	removeLayoutNodes(normalizedLayouts) {
		let nodes = this.map.overallOrder();
		for (let node of nodes) {
			if (!GlobalDependencyMap.isLayoutNode(this.map, node)) {
				continue;
			}

			// previous layout is not in the new layout map (no templates are using it)
			if (!normalizedLayouts[node]) {
				this.map.removeNode(node);
			}
			// important: if the layout map changed to have different templates (but was not removed)
			// this is already handled by `resetNode` called via TemplateMap
		}
	}

	// Eleventy Layouts don’t show up in the dependency graph, so we handle those separately
	async addLayoutsToMap(layouts) {
		let normalizedLayouts = this.normalizeLayoutsObject(layouts);

		// Clear out any previous layout relationships to make way for the new ones
		this.removeLayoutNodes(normalizedLayouts);

		for (let layout in normalizedLayouts) {
			// We add this pre-emptively to add the `layout` data
			if (!this.map.hasNode(layout)) {
				this.map.addNode(layout, {
					type: GlobalDependencyMap.LAYOUT_KEY,
				});
			} else {
				this.map.setNodeData(layout, {
					type: GlobalDependencyMap.LAYOUT_KEY,
				});
			}

			// Potential improvement: only add the first template in the chain for a template and manage any upstream layouts by their own relationships
			for (let pageTemplate of normalizedLayouts[layout]) {
				this.addDependency(pageTemplate, [layout]);
			}

			if (this.#templateConfig?.shouldSpiderJavaScriptDependencies()) {
				let deps = await JavaScriptDependencies.getDependencies([layout], this.isEsm);
				this.addDependency(layout, deps);
			}
		}
	}

	get map() {
		if (!this.#map) {
			// this.#map = new DepGraph({ circular: true });
			this.#map = new TemplateDepGraph();
		}

		return this.#map;
	}

	set map(graph) {
		this.#map = graph;
	}

	normalizeNode(node) {
		if (!node) {
			return;
		}

		// TODO tests for this
		// Fix URL objects passed in (sass does this)
		if (typeof node !== "string" && "toString" in node) {
			node = node.toString();
		}

		if (typeof node !== "string") {
			throw new Error("`addDependencies` files must be strings. Received:" + node);
		}

		return PathNormalizer.fullNormalization(node);
	}

	normalizeLayoutsObject(layouts) {
		let o = {};
		for (let rawLayout in layouts) {
			let layout = this.normalizeNode(rawLayout);
			o[layout] = layouts[rawLayout].map((entry) => this.normalizeNode(entry));
		}
		return o;
	}

	getDependantsFor(node) {
		if (!node) {
			return [];
		}

		node = this.normalizeNode(node);

		if (!this.map.hasNode(node)) {
			return [];
		}

		// Direct dependants and dependencies, both publish and consume from collections
		return this.map.directDependantsOf(node);
	}

	hasNode(node) {
		return this.map.hasNode(this.normalizeNode(node));
	}

	findCollectionsRemovedFrom(node, collectionNames) {
		if (!this.hasNode(node)) {
			return new Set();
		}

		let prevDeps = this.getDependantsFor(node)
			.map((entry) => GlobalDependencyMap.getTagName(entry))
			.filter(Boolean);

		let prevDepsSet = new Set(prevDeps);
		let deleted = new Set();
		for (let dep of prevDepsSet) {
			if (!collectionNames.has(dep)) {
				deleted.add(dep);
			}
		}

		return deleted;
	}

	resetNode(node) {
		node = this.normalizeNode(node);

		if (!this.map.hasNode(node)) {
			return;
		}

		// We don’t want to remove relationships that consume this, controlled by the upstream content
		// for (let dep of this.map.directDependantsOf(node)) {
		//   this.map.removeDependency(dep, node);
		// }

		for (let dep of this.map.directDependenciesOf(node)) {
			this.map.removeDependency(node, dep);
		}
	}

	getTemplatesThatConsumeCollections(collectionNames) {
		let templates = new Set();
		for (let name of collectionNames) {
			let collectionKey = GlobalDependencyMap.getCollectionKeyForEntry(name);
			if (!this.map.hasNode(collectionKey)) {
				continue;
			}
			for (let node of this.map.dependantsOf(collectionKey)) {
				if (!node.startsWith(GlobalDependencyMap.COLLECTION_PREFIX)) {
					if (!GlobalDependencyMap.isLayoutNode(this.map, node)) {
						templates.add(node);
					}
				}
			}
		}
		return templates;
	}

	static isLayoutNode(graph, node) {
		if (!graph.hasNode(node)) {
			return false;
		}
		return graph.getNodeData(node)?.type === GlobalDependencyMap.LAYOUT_KEY;
	}

	getLayoutsUsedBy(node) {
		node = this.normalizeNode(node);

		if (!this.map.hasNode(node)) {
			return [];
		}

		let layouts = [];

		// include self, if layout
		if (GlobalDependencyMap.isLayoutNode(this.map, node)) {
			layouts.push(node);
		}

		this.map.dependantsOf(node).forEach((node) => {
			// we only want layouts
			if (GlobalDependencyMap.isLayoutNode(this.map, node)) {
				return layouts.push(node);
			}
		});

		return layouts;
	}

	// In order
	// Does not include original templatePaths (unless *they* are second-order relevant)
	getTemplatesRelevantToTemplateList(templatePaths) {
		let overallOrder = this.map.overallOrder();
		overallOrder = this.filterOutLayouts(overallOrder);
		overallOrder = this.filterOutCollections(overallOrder);

		let relevantLookup = {};
		for (let inputPath of templatePaths) {
			inputPath = TemplatePath.stripLeadingDotSlash(inputPath);

			let deps = this.getDependencies(inputPath, false);

			if (Array.isArray(deps)) {
				let paths = this.filterOutCollections(deps);
				for (let node of paths) {
					relevantLookup[node] = true;
				}
			}
		}

		return overallOrder.filter((node) => {
			if (relevantLookup[node]) {
				return true;
			}
			return false;
		});
	}

	// Layouts are not relevant to compile cache and can be ignored
	getDependencies(node, includeLayouts = true) {
		node = this.normalizeNode(node);

		// `false` means the Node was unknown
		if (!this.map.hasNode(node)) {
			return false;
		}

		if (includeLayouts) {
			return this.map.dependenciesOf(node).filter(Boolean);
		}

		return GlobalDependencyMap.removeLayoutNodes(this.map, this.map.dependenciesOf(node));
	}

	#addNode(name) {
		if (this.map.hasNode(name)) {
			return;
		}

		this.map.addNode(name);
	}

	// node arguments are already normalized
	#addDependency(from, toArray = []) {
		this.#addNode(from); // only if not already added

		if (!Array.isArray(toArray)) {
			throw new Error("Second argument to `addDependency` must be an Array.");
		}

		// debug("%o depends on %o", from, toArray);
		for (let to of toArray) {
			this.#addNode(to); // only if not already added
			if (from !== to) {
				this.map.addDependency(from, to);
			}
		}
	}

	addDependency(from, toArray = []) {
		this.#addDependency(
			this.normalizeNode(from),
			toArray.map((to) => this.normalizeNode(to)),
		);
	}

	addNewNodeRelationships(from, consumes = [], publishes = []) {
		consumes = consumes.filter(Boolean);
		publishes = publishes.filter(Boolean);

		debug("%o consumes %o and publishes to %o", from, consumes, publishes);
		from = this.normalizeNode(from);

		this.map.addTemplate(from, consumes, publishes);
	}

	// Layouts are not relevant to compile cache and can be ignored
	hasDependency(from, to, includeLayouts) {
		to = this.normalizeNode(to);

		let deps = this.getDependencies(from, includeLayouts); // normalizes `from`

		if (!deps) {
			return false;
		}

		return deps.includes(to);
	}

	// Layouts are not relevant to compile cache and can be ignored
	isFileRelevantTo(fullTemplateInputPath, comparisonFile, includeLayouts) {
		fullTemplateInputPath = this.normalizeNode(fullTemplateInputPath);
		comparisonFile = this.normalizeNode(comparisonFile);

		// No watch/serve changed file
		if (!comparisonFile) {
			return false;
		}

		// The file that changed is the relevant file
		if (fullTemplateInputPath === comparisonFile) {
			return true;
		}

		// The file that changed is a dependency of the template
		// comparisonFile is used by fullTemplateInputPath
		if (this.hasDependency(fullTemplateInputPath, comparisonFile, includeLayouts)) {
			return true;
		}

		return false;
	}

	areFilesUsedBy(parents, child, includeLayouts) {
		for (let p of parents) {
			if (this.hasDependency(p, child, includeLayouts)) {
				// child is used by parent
				return true;
			}
		}
		return false;
	}

	getTemplateOrder() {
		let order = [];
		for (let entry of this.map.overallOrder()) {
			order.push(entry);
		}

		return order;
	}

	stringify() {
		return JSON.stringify(this.map, function replacer(key, value) {
			// Serialize internal Map objects.
			if (value instanceof Map) {
				let obj = {};
				for (let [k, v] of value) {
					obj[k] = v;
				}
				return obj;
			}

			return value;
		});
	}

	restore(persisted) {
		let obj = JSON.parse(persisted);
		let graph = new TemplateDepGraph();

		// https://github.com/jriecken/dependency-graph/issues/44
		// Restore top level serialized Map objects (in stringify above)
		for (let key in obj) {
			let map = graph[key];
			for (let k in obj[key]) {
				let v = obj[key][k];
				map.set(k, v);
			}
		}
		this.map = graph;
	}
}

export default GlobalDependencyMap;
