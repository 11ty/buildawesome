import { TemplatePath } from "@11ty/eleventy-utils";

import TemplateData from "./Data/TemplateData.js";
import Sortable from "./Util/Objects/Sortable.js";
import { isGlobMatch } from "./Util/GlobMatcher.js";

class TemplateCollection extends Sortable {
	// tag name => sorted items, rebuilt after any `add()`
	#tagIndex;

	constructor() {
		super();

		this._filteredByGlobsCache = new Map();
	}

	add(item) {
		this.#tagIndex = undefined;
		super.add(item);
	}

	getAll() {
		return this.items.slice();
	}

	getAllSorted() {
		return this.sort(Sortable.sortFunctionDateInputPath);
	}

	getSortedByDate() {
		return this.sort(Sortable.sortFunctionDate);
	}

	getGlobs(globs) {
		if (typeof globs === "string") {
			globs = [globs];
		}

		globs = globs.map((glob) => TemplatePath.addLeadingDotSlash(glob));

		return globs;
	}

	getFilteredByGlob(globs) {
		globs = this.getGlobs(globs);

		let key = globs.join("::");
		if (!this._dirty) {
			// Try to find a pre-sorted list and clone it.
			if (this._filteredByGlobsCache.has(key)) {
				return [...this._filteredByGlobsCache.get(key)];
			}
		} else if (this._filteredByGlobsCache.size) {
			// Blow away cache
			this._filteredByGlobsCache = new Map();
		}

		let filtered = this.getAllSorted().filter((item) => {
			return isGlobMatch(item.inputPath, globs);
		});
		this._dirty = false;
		this._filteredByGlobsCache.set(key, [...filtered]);
		return filtered;
	}

	getFilteredByTag(tagName) {
		if (!tagName) {
			return this.getAllSorted();
		}

		if (!this.#tagIndex) {
			this.#tagIndex = new Map();
			for (let item of this.getAllSorted()) {
				for (let tag of new Set(TemplateData.getIncludedTagNames(item.data))) {
					if (!this.#tagIndex.has(tag)) {
						this.#tagIndex.set(tag, []);
					}
					this.#tagIndex.get(tag).push(item);
				}
			}
		}

		return this.#tagIndex.get(tagName)?.slice() ?? [];
	}

	getFilteredByTags(...tags) {
		return this.getAllSorted().filter((item) => {
			let itemTags = new Set(TemplateData.getIncludedTagNames(item.data));
			return tags.every((requiredTag) => {
				return itemTags.has(requiredTag);
			});
		});
	}
}

export default TemplateCollection;
