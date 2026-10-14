import { TemplatePath } from "@11ty/eleventy-utils";

import TemplateData from "./Data/TemplateData.js";
import Sortable from "./Util/Objects/Sortable.js";
import { isGlobMatch } from "./Util/GlobMatcher.js";

export default class TemplateCollection extends Sortable {
	// Sorted items, tag index, and glob matches, reset by `add`, the only entry point that mutates `items`
	#cache = {};

	add(item) {
		this.#cache = {};
		super.add(item);
	}

	getAll() {
		return this.items.slice();
	}

	#getAllSorted() {
		this.#cache.sorted ??= this.sort(Sortable.sortFunctionDateInputPath);
		return this.#cache.sorted;
	}

	// Tag name to items (in sorted order), so tag lookups don’t walk the full collection
	#getTagIndex() {
		if (!this.#cache.tags) {
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

			this.#cache.tags = index;
		}

		return this.#cache.tags;
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

		this.#cache.globs ??= new Map();

		let key = globs.join("::");
		if (!this.#cache.globs.has(key)) {
			let filtered = this.#getAllSorted().filter((item) => isGlobMatch(item.inputPath, globs));
			this.#cache.globs.set(key, filtered);
		}

		return this.#cache.globs.get(key).slice();
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
