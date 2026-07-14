import { isPlainObject } from "@11ty/eleventy-utils";
import lodash from "@11ty/lodash-custom";
import { DeepCopy } from "@11ty/eleventy-utils";

import BaseError from "../Errors/BaseError.js";
import { ProxyWrap } from "../Util/Objects/ProxyWrap.js";
// import { DeepFreeze } from "../Util/Objects/DeepFreeze.js";
import TemplateData from "../Data/TemplateData.js";

const { set: lodashSet, get: lodashGet, chunk: lodashChunk } = lodash;

class PaginationConfigError extends BaseError {}
class PaginationError extends BaseError {}

class Pagination {
	static NOT_FOUND_VALUE = "__NOT_FOUND_ERROR__";

	constructor(tmpl, data, config) {
		if (!config) {
			throw new PaginationConfigError("Expected `config` argument to Pagination class.");
		}

		this.config = config;

		this.setTemplate(tmpl);
		this.setData(data);
	}

	get inputPathForErrorMessages() {
		if (this.template) {
			return ` (${this.template.inputPath})`;
		}
		return "";
	}

	static hasPagination(data) {
		return "pagination" in data;
	}

	hasPagination() {
		if (!this.data) {
			throw new Error(
				`Missing \`setData\` call for Pagination object${this.inputPathForErrorMessages}`,
			);
		}
		return Pagination.hasPagination(this.data);
	}

	circularReferenceCheck(data) {
		let key = data.pagination.data;
		let includedTags = TemplateData.getIncludedTagNames(data);

		for (let tag of includedTags) {
			if (`collections.${tag}` === key) {
				throw new PaginationError(
					`Pagination circular reference${this.inputPathForErrorMessages}, data:\`${key}\` iterates over both the \`${tag}\` collection and also supplies pages to that collection.`,
				);
			}
		}
	}

	setData(data) {
		this.data = data || {};
		this.target = [];

		if (!this.hasPagination()) {
			return;
		}

		if (!data.pagination) {
			throw new Error(
				`Misconfigured pagination data in template front matter${this.inputPathForErrorMessages} (YAML front matter precaution: did you use tabs and not spaces for indentation?).`,
			);
		} else if (!("size" in data.pagination)) {
			throw new Error(
				`Missing pagination size in front matter data${this.inputPathForErrorMessages}`,
			);
		}
		this.circularReferenceCheck(data);

		this.size = data.pagination.size;
		this.alias = data.pagination.alias;
		this.fullDataSet = this._get(this.data, this._getDataKey());
		// this returns an array
		this.target = this._resolveItems();
		this.chunkedItems = this.pagedItems;
	}

	setTemplate(tmpl) {
		this.template = tmpl;
	}

	_getDataKey() {
		return this.data.pagination.data;
	}

	shouldResolveDataToObjectValues() {
		if ("resolve" in this.data.pagination) {
			return this.data.pagination.resolve === "values";
		}
		return false;
	}

	isIncluded(value) {
		const hasInclude = "include" in this.data.pagination;
		const hasExclude = "exclude" in this.data.pagination;
		if (hasInclude && hasExclude) {
			throw new Error("Pagination cannot have both `include` and `exclude` properties.");
		}
		if (hasInclude) {
			let included = this.data.pagination.include;
			if (Array.isArray(included)) {
				return included.includes(value);
			}
			return included === value;
		}
		if (hasExclude) {
			let excluded = this.data.pagination.exclude;
			if (Array.isArray(excluded)) {
				return !excluded.includes(value);
			}
			return excluded !== value;
		}

		// Let's keep this code for backwards compatibility to V2.
		// TODO remove in 3.0
		if ("filter" in this.data.pagination) {
			let filtered = this.data.pagination.filter;
			if (Array.isArray(filtered)) {
				return filtered.indexOf(value) === -1;
			}

			return filtered !== value;
		}

		return true;
	}

	_has(target, key) {
		let data = lodashGet(target, key, Pagination.NOT_FOUND_VALUE);
		return data !== Pagination.NOT_FOUND_VALUE;
	}

	_get(target, key) {
		let data = lodashGet(target, key, Pagination.NOT_FOUND_VALUE);
		if (data === Pagination.NOT_FOUND_VALUE) {
			throw new Error(
				`Could not find pagination data${this.inputPathForErrorMessages}, went looking for: ${key}`,
			);
		}
		return data;
	}

	_resolveItems() {
		let keys;
		if (Array.isArray(this.fullDataSet)) {
			keys = this.fullDataSet;
			this.paginationTargetType = "array";
		} else if (isPlainObject(this.fullDataSet)) {
			this.paginationTargetType = "object";
			if (this.shouldResolveDataToObjectValues()) {
				keys = Object.values(this.fullDataSet);
			} else {
				keys = Object.keys(this.fullDataSet);
			}
		} else {
			throw new Error(
				`Unexpected data found in pagination target${this.inputPathForErrorMessages}: expected an Array or an Object.`,
			);
		}

		// keys must be an array
		let result = keys.slice();

		if (this.data.pagination.before && typeof this.data.pagination.before === "function") {
			// we don’t need to make a copy of this because we .slice() above to create a new copy
			let fns = {};
			if (this.config) {
				fns = this.config.javascriptFunctions;
			}
			result = this.data.pagination.before.call(fns, result, this.data);
		}

		if (this.data.pagination.reverse === true) {
			result = result.reverse();
		}

		if (
			this.data.pagination.filter ||
			this.data.pagination.include ||
			this.data.pagination.exclude
		) {
			result = result.filter((value) => this.isIncluded(value));
		}

		return result;
	}

	get pagedItems() {
		if (!this.data) {
			throw new Error(
				`Missing \`setData\` call for Pagination object${this.inputPathForErrorMessages}`,
			);
		}

		const chunks = lodashChunk(this.target, this.size);
		if (this.data.pagination?.generatePageOnEmptyData) {
			return chunks.length ? chunks : [[]];
		} else {
			return chunks;
		}
	}

	getPageCount() {
		if (!this.hasPagination()) {
			return 0;
		}

		return this.chunkedItems.length;
	}

	getNormalizedItems(pageItems) {
		return this.size === 1 ? pageItems[0] : pageItems;
	}

	getOverrideDataPages(items, pageNumber) {
		return {
			// See Issue #345 for more examples
			page: {
				previous: pageNumber > 0 ? this.getNormalizedItems(items[pageNumber - 1]) : null,
				next: pageNumber < items.length - 1 ? this.getNormalizedItems(items[pageNumber + 1]) : null,
				first: items.length ? this.getNormalizedItems(items[0]) : null,
				last: items.length ? this.getNormalizedItems(items[items.length - 1]) : null,
			},

			pageNumber,
		};
	}

	getOverrideDataLinks(pageNumber, templateCount, links) {
		let obj = {};

		// links are okay but hrefs are better
		obj.previousPageLink = pageNumber > 0 ? links[pageNumber - 1] : null;
		obj.previous = obj.previousPageLink;

		obj.nextPageLink = pageNumber < templateCount - 1 ? links[pageNumber + 1] : null;
		obj.next = obj.nextPageLink;

		obj.firstPageLink = links.length > 0 ? links[0] : null;
		obj.lastPageLink = links.length > 0 ? links[links.length - 1] : null;

		obj.links = links;
		// todo deprecated, consistency with collections and use links instead
		obj.pageLinks = links;
		return obj;
	}

	getOverrideDataHrefs(pageNumber, templateCount, hrefs) {
		let obj = {};

		// hrefs are better than links
		obj.previousPageHref = pageNumber > 0 ? hrefs[pageNumber - 1] : null;
		obj.nextPageHref = pageNumber < templateCount - 1 ? hrefs[pageNumber + 1] : null;

		obj.firstPageHref = hrefs.length > 0 ? hrefs[0] : null;
		obj.lastPageHref = hrefs.length > 0 ? hrefs[hrefs.length - 1] : null;

		obj.hrefs = hrefs;

		// better names
		obj.href = {
			previous: obj.previousPageHref,
			next: obj.nextPageHref,
			first: obj.firstPageHref,
			last: obj.lastPageHref,
		};

		return obj;
	}

	async getPageTemplates() {
		if (!this.data) {
			throw new Error(
				`Missing \`setData\` call for Pagination object${this.inputPathForErrorMessages}`,
			);
		}

		if (!this.hasPagination()) {
			return [];
		}

		let entries = [];
		let items = this.chunkedItems;
		let pages = this.size === 1 ? items.map((entry) => entry[0]) : items;

		let links = [];
		let hrefs = [];

		let hasPermalinkField =
			Boolean(this.data[this.config.keys.permalink]) ||
			Boolean(this.data.eleventyComputed?.[this.config.keys.permalink]);

		// Do *not* pass collections through DeepCopy, we’ll re-add them back in later.
		let collections = this.data.collections;
		if (collections) {
			delete this.data.collections;
		}

		let parentData = DeepCopy(
			{
				pagination: {
					data: this.data.pagination.data,
					size: this.data.pagination.size,
					alias: this.alias,
					pages,
				},
			},
			this.data,
		);

		// Restore skipped collections
		if (collections) {
			this.data.collections = collections;
			// Keep the original reference to the collections, no deep copy!!
			parentData.collections = collections;
		}

		// TODO this does work fine but let’s wait on enabling it.
		// DeepFreeze(parentData, ["collections"]);

		// TODO future improvement dea: use a light Template wrapper for paged template clones (PagedTemplate?)
		// so that we don’t have the memory cost of the full template (and can reuse the parent
		// template for some things)

		let indices = new Set();
		for (let j = 0; j <= items.length - 1; j++) {
			indices.add(j);
		}

		for (let pageNumber of indices) {
			let cloned = await this.template.clone();

			if (pageNumber > 0 && !hasPermalinkField) {
				cloned.setExtraOutputSubdirectory(pageNumber);
			}

			let paginationData = {
				pagination: {
					items: items[pageNumber],
				},
				page: {},
			};
			Object.assign(paginationData.pagination, this.getOverrideDataPages(items, pageNumber));

			if (this.alias) {
				lodashSet(paginationData, this.alias, this.getNormalizedItems(items[pageNumber]));
			}

			// Do *not* deep merge pagination data! See https://github.com/11ty/eleventy/issues/147#issuecomment-440802454
			let clonedData = ProxyWrap(paginationData, parentData);

			// Previous method:
			// let clonedData = DeepCopy(paginationData, parentData);

			let { /*linkInstance,*/ rawPath, path, href, dir } =
				await cloned.getOutputLocations(clonedData);
			// TODO subdirectory to links if the site doesn’t live at /
			if (rawPath) {
				links.push("/" + rawPath);
			}

			hrefs.push(href);

			// page.url and page.outputPath are used to avoid another getOutputLocations call later, see Template->addComputedData
			clonedData.page.url = href;
			clonedData.page.outputPath = path;

			entries.push({
				pageNumber,

				// This is used by i18n Plugin to allow subgroups of nested pagination to be separate
				groupNumber: items[pageNumber]?.[0]?.eleventyPaginationGroupNumber,

				template: cloned,
				data: clonedData,
			});
		}

		// we loop twice to pass in the appropriate prev/next links (already full generated now)
		let index = 0;
		for (let pageEntry of entries) {
			let linksObj = this.getOverrideDataLinks(index, items.length, links);

			Object.assign(pageEntry.data.pagination, linksObj);

			let hrefsObj = this.getOverrideDataHrefs(index, items.length, hrefs);
			Object.assign(pageEntry.data.pagination, hrefsObj);
			index++;
		}

		return entries;
	}
}

export default Pagination;
