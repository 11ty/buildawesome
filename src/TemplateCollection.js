import { TemplatePath } from "@11ty/eleventy-utils";

import TemplateData from "./Data/TemplateData.js";
import Sortable from "./Util/Objects/Sortable.js";
import { isGlobMatch } from "./Util/GlobMatcher.js";

class TemplateCollection extends Sortable {
	// Both caches are invalidated in `add`, the only entry point that mutates `items`
	#allSortedCache;
	#tagIndexCache;

	constructor() {
		super();

		this._filteredByGlobsCache = new Map();
	}

	add(item) {
		this.#allSortedCache = undefined;
		this.#tagIndexCache = undefined;

		super.add(item);
	}

	getAll() {
		return this.items.slice();
	}

	// Sorted once per mutation instead of once per collection API call
	#getAllSorted() {
		if (!this.#allSortedCache) {
			this.#allSortedCache = this.sort(Sortable.sortFunctionDateInputPath);
		}

		return this.#allSortedCache;
	}

	// Tag name to items (in sorted order), so tag lookups don’t walk the full collection
	#getTagIndex() {
		if (!this.#tagIndexCache) {
			let index = new Map();

			for (let item of this.#getAllSorted()) {
				for (let tagName of TemplateData.getIncludedTagNames(item.data)) {
					let tagItems = index.get(tagName);
					if (!tagItems) {
						tagItems = [];
						index.set(tagName, tagItems);
					}
					tagItems.push(item);
				}
			}

			this.#tagIndexCache = index;
		}

		return this.#tagIndexCache;
	}

	getAllSorted() {
		// Callers sort and reverse the result in place, so hand out a copy
		return this.#getAllSorted().slice();
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

		return this.#getTagIndex().get(tagName)?.slice() || [];
	}

	getFilteredByTags(...tags) {
		if (!tags.length) {
			return this.getAllSorted();
		}

		let index = this.#getTagIndex();
		let [firstTag, ...remainingTags] = tags;
		let matches = index.get(firstTag) || [];
		if (!remainingTags.length) {
			return matches.slice();
		}

		// Intersect the first tag’s matches with the remaining tags
		let remainingItems = remainingTags.map((tagName) => new Set(index.get(tagName)));
		return matches.filter((item) => {
			return remainingItems.every((tagItems) => tagItems.has(item));
		});
	}
}

export default TemplateCollection;
