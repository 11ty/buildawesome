import { isPlainObject, TemplatePath } from "@11ty/eleventy-utils";

import TemplateCollection from "./TemplateCollection.js";
import ErrorUtil from "./Errors/ErrorUtil.js";
import UsingCircularTemplateContentReferenceError from "./Errors/UsingCircularTemplateContentReferenceError.js";
import DuplicatePermalinkOutputError from "./Errors/DuplicatePermalinkOutputError.js";
import TemplateData from "./Data/TemplateData.js";
import GlobalDependencyMap from "./GlobalDependencyMap.js";
import { ResolveConfigurationData } from "./Data/ResolveConfigurationData.js";
import { createDebug } from "./Util/DebugLogUtil.js";

const debug = createDebug("TemplateMap");

// These template URL filenames are allowed to exclude file extensions
const EXTENSIONLESS_URL_ALLOWLIST = [
	"/_redirects", // Netlify specific
	"/.htaccess", // Apache
	"/_headers", // Cloudflare
];

// must match TemplateDepGraph
const SPECIAL_COLLECTION_NAMES = {
	keys: "[keys]",
	all: "all",
};

class TemplateMap {
	#dependencyMapInitialized = false;
	#templateData;

	constructor(eleventyConfig) {
		if (!eleventyConfig || eleventyConfig.constructor.name !== "TemplateConfig") {
			throw new Error("Missing or invalid `eleventyConfig` argument.");
		}
		this.eleventyConfig = eleventyConfig;
		this.map = [];
		this.inputPathMap = new Map(); // NEW: O(1) lookup Map for performance
		this.collectionsData = null;
		this.cached = false;
		this.collection = new TemplateCollection();
	}

	set userConfig(config) {
		this._userConfig = config;
	}

	get userConfig() {
		if (!this._userConfig) {
			// TODO use this.config for this, need to add collections to mergeable props in userconfig
			this._userConfig = this.eleventyConfig.userConfig;
		}

		return this._userConfig;
	}

	get config() {
		if (!this._config) {
			this._config = this.eleventyConfig.getConfig();
		}
		return this._config;
	}

	setTemplateData(templateData) {
		this.#templateData = templateData;
	}

	async add(template) {
		if (!template) {
			return;
		}

		let data = await template.getData();
		let map = await template.getTemplateMapEntry(data);
		let { skippedVia } = await template.runPreprocessors(data);

		if (!map || skippedVia) {
			return;
		}

		this.map.push(map);
		this.#addToInputPathMap(map); // NEW: Add to lookup Map for O(1) access
	}

	getMap() {
		return this.map;
	}

	#addToInputPathMap(mapEntry) {
		// Store under absolute path
		let absoluteInputPath = TemplatePath.absolutePath(mapEntry.inputPath);
		this.inputPathMap.set(absoluteInputPath, mapEntry);
	}

	getTagTarget(str) {
		if (str === "collections") {
			// special, means targeting `collections` specifically
			return SPECIAL_COLLECTION_NAMES.keys;
		}

		if (str.startsWith("collections.")) {
			return str.slice("collections.".length);
		}

		// Fixes #2851
		if (str.startsWith("collections['") || str.startsWith('collections["')) {
			return str.slice("collections['".length, -2);
		}
	}

	getPaginationTagTarget(entry) {
		if (entry.data.pagination?.data) {
			return this.getTagTarget(entry.data.pagination.data);
		}
	}

	#addEntryToGlobalDependencyGraph(entry) {
		let consumes = [];
		consumes.push(this.getPaginationTagTarget(entry));

		let importData = ResolveConfigurationData.getValue(entry.data, this.config.keys.import);
		if (Array.isArray(importData?.collections)) {
			for (let tag of importData.collections) {
				consumes.push(tag);
			}
		}

		// Important: consumers must come before publishers

		// TODO it’d be nice to set the dependency relationship for addCollection here
		// But collections are not yet populated (they populate after template order)
		let publishes = TemplateData.getIncludedCollectionNames(entry.data);

		this.config.uses.addNewNodeRelationships(entry.inputPath, consumes, publishes);
	}

	addAllToGlobalDependencyGraph() {
		this.#dependencyMapInitialized = true;

		// Should come before individual entry additions
		this.config.uses.initializeUserConfigurationApiCollections();

		for (let entry of this.map) {
			this.#addEntryToGlobalDependencyGraph(entry);
		}
	}

	async setCollectionByTagName(tagName) {
		if (this.isUserConfigCollectionName(tagName)) {
			// async
			this.collectionsData[tagName] = await this.getUserConfigCollection(tagName);
		} else {
			this.collectionsData[tagName] = this.getTaggedCollection(tagName);
		}

		let precompiled = this.config.precompiledCollections;
		if (precompiled?.[tagName]) {
			if (
				tagName === "all" ||
				!Array.isArray(this.collectionsData[tagName]) ||
				this.collectionsData[tagName].length === 0
			) {
				this.collectionsData[tagName] = precompiled[tagName];
			}
		}
	}

	// TODO(slightlyoff): major bottleneck
	async initDependencyMap(fullTemplateOrder) {
		// Temporary workaround for async constructor work in templates
		// Issue #3170 #3870
		let inputPathSet = new Set(fullTemplateOrder);
		await Promise.all(
			this.map
				.filter(({ inputPath }) => {
					return inputPathSet.has(inputPath);
				})
				.map(({ template }) => {
					// This also happens for layouts in TemplateContent->compile
					return template.asyncTemplateInitialization();
				}),
		);

		for (let depEntry of fullTemplateOrder) {
			if (GlobalDependencyMap.isCollection(depEntry)) {
				let tagName = GlobalDependencyMap.getTagName(depEntry);
				// [keys] should initialize `all`
				if (tagName === SPECIAL_COLLECTION_NAMES.keys) {
					await this.setCollectionByTagName("all");
					// [NAME] is special and implied (e.g. [keys])
				} else if (!tagName.startsWith("[") && !tagName.endsWith("]")) {
					// is a tag (collection) entry
					await this.setCollectionByTagName(tagName);
				}
				continue;
			}

			// is a template entry
			let map = this.getMapEntryForInputPath(depEntry);
			await this.#initDependencyMapEntry(map);
		}
	}

	async #initDependencyMapEntry(map) {
		try {
			map._pages = await map.template.getTemplates(map.data);
		} catch (e) {
			throw new Error("Error generating template page(s) for " + map.inputPath + ".", { cause: e });
		}

		if (map._pages.length === 0) {
			// Reminder: a serverless code path was removed here.
		} else {
			let counter = 0;
			for (let page of map._pages) {
				// Copy outputPath to map entry
				// This is no longer used internally, just for backwards compatibility
				// Error added in v3 for https://github.com/11ty/eleventy/issues/3183
				if (map.data.pagination) {
					if (!Object.prototype.hasOwnProperty.call(map, "outputPath")) {
						Object.defineProperty(map, "outputPath", {
							get() {
								throw new Error(
									"Internal error: `.outputPath` on a paginated map entry is not consistent. Use `_pages[…].outputPath` instead.",
								);
							},
						});
					}
				} else if (!map.outputPath) {
					map.outputPath = page.outputPath;
				}

				if (counter === 0 || map.data.pagination?.addAllPagesToCollections) {
					if (
						ResolveConfigurationData.getValue(map.data, "buildawesomeExcludeFromCollections") !==
						true
					) {
						// is in *some* collections
						this.collection.add(page);
					}
				}

				counter++;
			}
		}
	}

	getTemplateOrder() {
		// 1. Templates that don’t use Pagination
		// 2. Pagination templates that consume config API collections
		// 3. Pagination templates consuming `collections`
		// 4. Pagination templates consuming `collections.all`
		let fullTemplateOrder = this.config.uses.getTemplateOrder();

		return fullTemplateOrder
			.map((entry) => {
				if (GlobalDependencyMap.isCollection(entry)) {
					return entry;
				}

				let inputPath = TemplatePath.addLeadingDotSlash(entry);
				if (!this.hasMapEntryForInputPath(inputPath)) {
					return false;
				}
				return inputPath;
			})
			.filter(Boolean);
	}

	async cache() {
		if (!this.#dependencyMapInitialized) {
			this.addAllToGlobalDependencyGraph();
		}

		this.collectionsData = {};

		for (let entry of this.map) {
			entry.data.collections = this.collectionsData;
		}

		let fullTemplateOrder = this.getTemplateOrder();
		debug(
			"Rendering templates in order (%o concurrency): %O",
			this.userConfig.getConcurrency(),
			fullTemplateOrder,
		);

		await this.initDependencyMap(fullTemplateOrder);
		await this.refreshUserConfigCollections(fullTemplateOrder);
		await this.resolveRemainingComputedData();

		let orderedPaths = this.#removeTagsFromTemplateOrder(fullTemplateOrder);

		let orderedMap = orderedPaths.map((inputPath) => {
			return this.getMapEntryForInputPath(inputPath);
		});

		await this.config.events.emitLazy("buildawesome.contentmap", () => {
			return {
				inputPathToUrl: this.generateInputUrlContentMap(orderedMap),
				urlToInputPath: this.generateUrlMap(orderedMap),
			};
		});

		await this.runDataSchemas(orderedMap);
		await this.populateContentDataInMap(orderedMap);

		this.populateCollectionsWithContent();
		this.cached = true;

		this.checkForDuplicatePermalinks();
		this.checkForMissingFileExtensions();

		await this.config.events.emitLazy("buildawesome.layouts", () => this.generateLayoutsMap());
	}

	generateInputUrlContentMap(orderedMap) {
		let entries = {};
		for (let entry of orderedMap) {
			entries[entry.inputPath] = entry._pages.map((entry) => entry.url);
		}
		return entries;
	}

	generateUrlMap(orderedMap) {
		let entries = {};
		for (let entry of orderedMap) {
			for (let page of entry._pages) {
				// duplicate urls throw an error, so we can return non array here
				entries[page.url] = {
					inputPath: entry.inputPath,
					groupNumber: page.groupNumber,
				};
			}
		}
		return entries;
	}

	hasMapEntryForInputPath(inputPath) {
		return Boolean(this.getMapEntryForInputPath(inputPath));
	}

	getMapEntryForInputPath(inputPath) {
		let absoluteInputPath = TemplatePath.absolutePath(inputPath);
		return this.inputPathMap.get(absoluteInputPath);
	}

	#removeTagsFromTemplateOrder(maps) {
		return maps.filter((dep) => !GlobalDependencyMap.isCollection(dep));
	}

	async runDataSchemas(orderedMap) {
		for (let map of orderedMap) {
			if (!map._pages) {
				continue;
			}

			for (let pageEntry of map._pages) {
				// Data Schema callback #879
				let { location: dataSchemaLocation, value: dataSchema } = ResolveConfigurationData.resolve(
					pageEntry.data,
					this.config.keys.dataSchema,
				);
				if (dataSchema !== undefined && typeof dataSchema === "function") {
					try {
						await dataSchema(pageEntry.data);
					} catch (e) {
						throw new Error(
							`Error in the data schema for: ${map.inputPath} (via \`${dataSchemaLocation}\`)`,
							{ cause: e },
						);
					}
				}
			}
		}
	}

	async populateContentDataInMap(orderedMap) {
		let usedTemplateContentTooEarlyMap = [];

		// Note that empty pagination templates will be skipped here as not renderable
		let filteredMap = orderedMap.filter((entry) => entry.template.isRenderable());

		// Get concurrency level from user config
		const concurrency = this.userConfig.getConcurrency();

		// Process the templates in chunks to limit concurrency
		// This replaces the functionality of p-map's concurrency option
		for (let i = 0; i < filteredMap.length; i += concurrency) {
			// Create a chunk of tasks that will run in parallel
			const chunk = filteredMap.slice(i, i + concurrency);

			// Run the chunk of tasks in parallel
			await Promise.all(
				chunk.map(async (map) => {
					if (!map._pages) {
						throw new Error(`Internal error: _pages not found for ${map.inputPath}`);
					}

					// IMPORTANT: this is where template content is rendered
					try {
						for (let pageEntry of map._pages) {
							pageEntry.templateContent =
								await pageEntry.template.renderPageEntryWithoutLayout(pageEntry);
						}
					} catch (e) {
						if (ErrorUtil.isPrematureTemplateContentError(e)) {
							// Add to list of templates that need to be processed again
							usedTemplateContentTooEarlyMap.push(map);

							// Reset cached render promise
							for (let pageEntry of map._pages) {
								pageEntry.template.resetCaches({ render: true });
							}
						} else {
							throw e;
						}
					}
				}),
			);
		}

		// Process templates that had premature template content errors
		// This is the second pass for templates that couldn't be rendered in the first pass
		for (let map of usedTemplateContentTooEarlyMap) {
			try {
				for (let pageEntry of map._pages) {
					pageEntry.templateContent =
						await pageEntry.template.renderPageEntryWithoutLayout(pageEntry);
				}
			} catch (e) {
				if (ErrorUtil.isPrematureTemplateContentError(e)) {
					// If we still have template content errors after the second pass,
					// it's likely a circular reference
					throw new UsingCircularTemplateContentReferenceError(
						`${map.inputPath} contains a circular reference (using collections) to its own templateContent.`,
					);
				} else {
					// rethrow?
					throw e;
				}
			}
		}
	}

	getTaggedCollection(tag) {
		let result;
		if (!tag || tag === "all") {
			result = this.collection.getAllSorted();
		} else {
			result = this.collection.getFilteredByTag(tag);
		}

		// May not return an array (can be anything)
		// https://www.11ty.dev/docs/collections-api/#return-values
		debug(`Collection: collections.${tag || "all"} size: ${result?.length}`);

		return result;
	}

	/* 3.0.0-alpha.1: setUserConfigCollections method removed (was only used for testing) */
	isUserConfigCollectionName(name) {
		let collections = this.userConfig.getCollections();
		return name && !!collections[name];
	}

	getUserConfigCollectionNames() {
		return Object.keys(this.userConfig.getCollections());
	}

	async getUserConfigCollection(name) {
		let configCollections = this.userConfig.getCollections();

		// This works with async now
		let result = await configCollections[name](this.collection);

		// May not return an array (can be anything)
		// https://www.11ty.dev/docs/collections-api/#return-values
		debug(`Collection: collections.${name} size: ${result?.length}`);
		return result;
	}

	async refreshUserConfigCollections(templateOrder = []) {
		for (let entry of templateOrder) {
			if (!GlobalDependencyMap.isCollection(entry)) {
				continue;
			}

			let tagName = GlobalDependencyMap.getTagName(entry);
			if (!this.isUserConfigCollectionName(tagName)) {
				continue;
			}

			await this.setCollectionByTagName(tagName);
		}
	}

	populateCollectionsWithContent() {
		for (let collectionName in this.collectionsData) {
			// skip custom collections set in configuration files that have arbitrary types
			if (!Array.isArray(this.collectionsData[collectionName])) {
				continue;
			}

			for (let item of this.collectionsData[collectionName]) {
				// skip custom collections set in configuration files that have arbitrary types
				if (!isPlainObject(item) || !("inputPath" in item)) {
					continue;
				}

				let entry = this.getMapEntryForInputPath(item.inputPath);
				// This check skips precompiled collections
				if (entry) {
					let index = item.pageNumber || 0;
					let content = entry._pages[index]._templateContent;
					if (content !== undefined) {
						item.templateContent = content;
					}
				}
			}
		}
	}

	async resolveRemainingComputedData() {
		let promises = [];
		for (let entry of this.map) {
			for (let pageEntry of entry._pages) {
				let computedData = ResolveConfigurationData.getValue(
					pageEntry.data,
					this.config.keys.computed,
				);
				if (computedData !== undefined) {
					promises.push(pageEntry.template.resolveRemainingComputedData(pageEntry.data));
				}
			}
		}
		return Promise.all(promises);
	}

	async generateLayoutsMap() {
		let layouts = {};

		for (let entry of this.map) {
			for (let page of entry._pages) {
				let tmpl = page.template;
				if (tmpl.templateUsesLayouts(page.data)) {
					let layoutKey = page.data[this.config.keys.layout];
					let layout = tmpl.getLayout(layoutKey);
					let layoutChain = await layout.getLayoutChain();
					let priors = [];
					for (let filepath of layoutChain) {
						if (!layouts[filepath]) {
							layouts[filepath] = new Set();
						}
						layouts[filepath].add(page.inputPath);
						for (let prior of priors) {
							layouts[filepath].add(prior);
						}
						priors.push(filepath);
					}
				}
			}
		}

		for (let key in layouts) {
			layouts[key] = Array.from(layouts[key]);
		}

		return layouts;
	}

	#onEachPage(callback) {
		for (let template of this.map) {
			for (let page of template._pages) {
				callback(page, template);
			}
		}
	}

	checkForDuplicatePermalinks() {
		let inputs = {};
		let outputPaths = {};
		let warnings = {};
		this.#onEachPage((page, template) => {
			if (page.outputPath === false || page.url === false) {
				// do nothing (also serverless)
			} else {
				// Make sure output doesn’t overwrite input (e.g. --input=. --output=.)
				// Related to https://github.com/11ty/eleventy/issues/3327
				if (page.outputPath === page.inputPath) {
					throw new DuplicatePermalinkOutputError(
						`The template at "${page.inputPath}" attempted to overwrite itself.`,
					);
				} else if (inputs[page.outputPath]) {
					throw new DuplicatePermalinkOutputError(
						`The template at "${page.inputPath}" attempted to overwrite an existing template at "${page.outputPath}".`,
					);
				}
				inputs[page.inputPath] = true;

				if (!outputPaths[page.outputPath]) {
					outputPaths[page.outputPath] = [template.inputPath];
				} else {
					warnings[page.outputPath] = `Output conflict: multiple input files are writing to \`${
						page.outputPath
					}\`. Use distinct \`permalink\` values to resolve this conflict.
  1. ${template.inputPath}
${outputPaths[page.outputPath]
	.map(function (inputPath, index) {
		return `  ${index + 2}. ${inputPath}\n`;
	})
	.join("")}
`;
					outputPaths[page.outputPath].push(template.inputPath);
				}
			}
		});

		let warningList = Object.values(warnings);
		if (warningList.length) {
			// throw one at a time
			throw new DuplicatePermalinkOutputError(warningList[0]);
		}
	}

	checkForMissingFileExtensions() {
		// disabled in config
		if (this.userConfig?.errorReporting?.allowMissingExtensions === true) {
			return;
		}

		this.#onEachPage((page) => {
			if (
				page.outputPath === false ||
				page.url === false ||
				page.data.eleventyAllowMissingExtension ||
				EXTENSIONLESS_URL_ALLOWLIST.some((url) => page.url.endsWith(url))
			) {
				// do nothing (also serverless)
			} else {
				if (TemplatePath.getExtension(page.outputPath) === "") {
					let e =
						new Error(`The template at '${page.inputPath}' attempted to write to '${page.outputPath}'${page.data.permalink ? ` (via \`permalink\` value: '${page.data.permalink}')` : ""}, which is a target on the file system that does not include a file extension.

You *probably* want to add a file extension to your permalink so that hosts will know how to correctly serve this file to web browsers. Without a file extension, this file may not be reliably deployed without additional hosting configuration (it won’t have a mime type) and may also cause local development issues if you later attempt to write to a subdirectory of the same name.

Learn more: https://v3.11ty.dev/docs/permalinks/#trailing-slashes

This is usually but not *always* an error so if you’d like to disable this error message, add \`eleventyAllowMissingExtension: true\` somewhere in the data cascade for this template or use \`$config.configureErrorReporting({ allowMissingExtensions: true });\` to disable this feature globally.`);
					e.skipOriginalStack = true;
					throw e;
				}
			}
		});
	}

	// TODO move these into TemplateMapTest.js
	_testGetAllTags() {
		let allTags = {};
		for (let map of this.map) {
			let tags = map.data.tags;
			if (Array.isArray(tags)) {
				for (let tag of tags) {
					allTags[tag] = true;
				}
			}
		}
		return Object.keys(allTags);
	}

	async _testGetUserConfigCollectionsData() {
		let collections = {};
		let configCollections = this.userConfig.getCollections();

		for (let name in configCollections) {
			collections[name] = configCollections[name](this.collection);

			debug(`Collection: collections.${name} size: ${collections[name].length}`);
		}

		return collections;
	}

	async _testGetTaggedCollectionsData() {
		let collections = {};
		collections.all = this.collection.getAllSorted();
		debug(`Collection: collections.all size: ${collections.all.length}`);

		let tags = this._testGetAllTags();
		for (let tag of tags) {
			collections[tag] = this.collection.getFilteredByTag(tag);
			debug(`Collection: collections.${tag} size: ${collections[tag].length}`);
		}
		return collections;
	}

	async _testGetAllCollectionsData() {
		let collections = {};
		let taggedCollections = await this._testGetTaggedCollectionsData();
		Object.assign(collections, taggedCollections);

		let userConfigCollections = await this._testGetUserConfigCollectionsData();
		Object.assign(collections, userConfigCollections);

		return collections;
	}

	async _testGetCollectionsData() {
		if (!this.cached) {
			await this.cache();
		}

		return this.collectionsData;
	}
}

export default TemplateMap;
