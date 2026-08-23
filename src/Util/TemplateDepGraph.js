import { DepGraph as DependencyGraph } from "dependency-graph";
import { createDebug } from "./DebugLogUtil.js";

const debug = createDebug("TemplateDepGraph");

const COLLECTION_PREFIX = "__collection:";

export class TemplateDepGraph extends DependencyGraph {
	static STAGES = ["[basic]", "[userconfig]", "[keys]", "all"];

	#configCollectionNames = new Set();

	constructor() {
		// BREAKING TODO move this back to non-circular with errors
		super({ circular: true });

		let previous;
		// establish stage relationships, all uses keys, keys uses userconfig, userconfig uses tags
		for (let stageName of TemplateDepGraph.STAGES.filter(Boolean).reverse()) {
			let stageKey = `${COLLECTION_PREFIX}${stageName}`;
			if (previous) {
				this.uses(previous, stageKey);
			}
			previous = stageKey;
		}
	}

	uses(from, to) {
		this.addDependency(from, to);
	}

	addTag(tagName, type) {
		if (
			tagName === "all" ||
			(tagName.startsWith("[") && tagName.endsWith("]")) ||
			this.#configCollectionNames.has(tagName)
		) {
			return;
		}
		if (!type) {
			throw new Error(
				`Missing tag type for addTag. Expecting one of ${TemplateDepGraph.STAGES.map((entry) => entry.slice(1, -1)).join(" or ")}. Received: ${type}`,
			);
		}

		debug("collection type %o uses tag %o", tagName, type);

		this.uses(`${COLLECTION_PREFIX}[${type}]`, `${COLLECTION_PREFIX}${tagName}`);
	}

	addConfigCollectionName(collectionName) {
		if (collectionName === "all") {
			return;
		}

		this.#configCollectionNames.add(collectionName);
		// Collection relationships to `[userconfig]` are added last, in unfilteredOrder()
	}

	cleanupCollectionNames(collectionNames = []) {
		let s = new Set(collectionNames);
		if (s.has("[userconfig]")) {
			return collectionNames;
		}

		let hasAnyConfigCollections = collectionNames.find((name) => {
			if (this.#configCollectionNames.has(name)) {
				return true;
			}
			return false;
		});

		if (hasAnyConfigCollections) {
			s.add("[userconfig]");
		}

		return Array.from(s);
	}

	addTemplate(filePath, consumes = [], publishesTo = []) {
		// Move to the beginning if it doesn’t consume anything
		if (consumes.length === 0) {
			this.uses(`${COLLECTION_PREFIX}[basic]`, filePath);
		}

		consumes = this.cleanupCollectionNames(consumes);
		publishesTo = this.cleanupCollectionNames(publishesTo);
		// Can’t consume AND publish to `all` simultaneously
		let consumesAll = consumes.includes("all");
		if (consumesAll) {
			publishesTo = publishesTo.filter((entry) => entry !== "all");
		}

		debug("%o consumes %o and publishes to %o", filePath, consumes, publishesTo);

		for (let collectionName of publishesTo) {
			if (!consumesAll) {
				let tagType = "basic";

				let consumesUserConfigCollection = consumes.includes("[userconfig]");
				if (consumesUserConfigCollection) {
					// must finish before [keys]
					tagType = "keys";
				}

				this.addTag(collectionName, tagType);
			}

			this.uses(`${COLLECTION_PREFIX}${collectionName}`, filePath);
		}

		for (let collectionName of consumes) {
			this.uses(filePath, `${COLLECTION_PREFIX}${collectionName}`);

			let stageIndex = TemplateDepGraph.STAGES.indexOf(collectionName);
			let nextStage = stageIndex > 0 ? TemplateDepGraph.STAGES[stageIndex + 1] : undefined;
			if (nextStage) {
				this.uses(`${COLLECTION_PREFIX}${nextStage}`, filePath);
			}
		}
	}

	addDependency(from, to) {
		if (!this.hasNode(from)) {
			this.addNode(from);
		}
		if (!this.hasNode(to)) {
			this.addNode(to);
		}
		super.addDependency(from, to);
	}

	unfilteredOrder() {
		// these need to be added last, after the template map has been added (see addConfigCollectionName)
		for (let collectionName of this.#configCollectionNames) {
			this.uses(`${COLLECTION_PREFIX}[keys]`, `${COLLECTION_PREFIX}${collectionName}`);
		}

		return super.overallOrder();
	}

	overallOrder() {
		let unfiltered = this.unfilteredOrder();

		let filtered = unfiltered.filter((entry) => {
			if (entry === `${COLLECTION_PREFIX}[keys]`) {
				return true;
			}
			return !entry.startsWith(`${COLLECTION_PREFIX}[`) && !entry.endsWith("]");
		});

		let allKey = `${COLLECTION_PREFIX}all`;
		// Add another collections.all entry to the end (if not already the last one)
		if (filtered[filtered.length - 1] !== allKey) {
			filtered.push(allKey);
		}

		return filtered;
	}
}
