import path from "node:path";
import lodash from "@11ty/lodash-custom";
import { Merge, TemplatePath, isPlainObject } from "@11ty/eleventy-utils";

import { inspect } from "../Adapters/Packages/inspect.js";
import unique from "../Util/Objects/Unique.js";
import TemplateGlob from "../TemplateGlob.js";
import BaseError from "../Errors/BaseError.js";
import ConfigurationGlobalData from "./ConfigurationGlobalData.js";
import {
	getCorePackageJson,
	importJsonSync,
	getWorkingProjectPackageJsonPath,
} from "../Util/ImportJsonSync.js";
import { DynamicImport, LoadContent } from "../Util/Require.js";
import { DeepFreeze } from "../Util/Objects/DeepFreeze.js";
import { coerce } from "../Util/SemverCoerce.js";
import ReservedData from "../Util/ReservedData.js";
import { isTypeScriptSupported } from "../Util/TypeScriptFeatureTest.cjs";
import { ResolveConfigurationData } from "../Data/ResolveConfigurationData.js";
import { createDebug } from "../Util/DebugLogUtil.js";

const { set: lodashSet, get: lodashGet } = lodash;

const debugWarn = createDebug("Warnings");
const debug = createDebug("TemplateData");

class TemplateDataParseError extends BaseError {}

class TemplateData {
	static DEFAULT_TAGS_KEY = "tags";

	// Would be nice if the priorities here matched (see also FilePathUtil used by config file paths)

	// (json not included) priority is reverse order
	#eligibleJavaScriptExtensions = [
		...(isTypeScriptSupported() ? ["ts", "cts", "mts"] : []),
		"js",
		"cjs",
		"mjs",
	];

	// in order of priority
	#globalDataOrderedExtensions = [
		"json",
		"mjs",
		"cjs",
		"js",
		...(isTypeScriptSupported() ? ["mts", "cts", "ts"] : []),
	];

	#rawImports;
	#globalData;
	#templateDirectoryData = {};
	// Directory data files are shared by every template in the directory
	#dataFileContents = new Map();
	#directoryDataPaths = new Map();
	// Global data files for each top-level key
	#globalDataFilesByKey = new Map();

	constructor(templateConfig) {
		if (!templateConfig || templateConfig.constructor.name !== "TemplateConfig") {
			throw new Error(
				"Internal error: Missing `templateConfig` or was not an instance of `TemplateConfig`.",
			);
		}

		this.templateConfig = templateConfig;
		this.config = this.templateConfig.getConfig();

		this.benchmarks = {
			data: this.config.benchmarkManager.get("Data"),
			aggregate: this.config.benchmarkManager.get("Aggregate"),
		};

		this.isEsm = false;
		this.initialGlobalData = new ConfigurationGlobalData(this.templateConfig);
	}

	get dirs() {
		return this.templateConfig.directories;
	}

	get inputDir() {
		return this.dirs.input;
	}

	// if this was set but `falsy` we would fallback to inputDir
	get dataDir() {
		return this.dirs.data;
	}

	get absoluteDataDir() {
		return TemplatePath.absolutePath(this.dataDir);
	}

	// This was async in 2.0 and prior but doesn’t need to be any more.
	getInputDir() {
		return this.dirs.input;
	}

	getDataDir() {
		return this.dataDir;
	}

	exists(pathname) {
		// It's common for data files not to exist, so we avoid going to the FS to
		// re-check if they do via a quick-and-dirty cache.
		return this.templateConfig.existsCache.exists(pathname);
	}

	setFileSystemSearch(fileSystemSearch) {
		this.fileSystemSearch = fileSystemSearch;
	}

	setProjectUsingEsm(isEsmProject) {
		this.isEsm = !!isEsmProject;
	}

	get extensionMap() {
		if (!this._extensionMap) {
			throw new Error("Internal error: missing `extensionMap` in TemplateData.");
		}
		return this._extensionMap;
	}

	set extensionMap(map) {
		this._extensionMap = map;
	}

	get environmentVariables() {
		return this._env;
	}

	set environmentVariables(env) {
		this._env = env;
	}

	/* Used by tests */
	_setConfig(config) {
		this.config = config;
	}

	getRawImports() {
		if (!this.config.keys.package) {
			debug(
				"Opted-out of package.json assignment for global data with falsy value for `keys.package` configuration.",
			);
			return;
		}

		if (this.#rawImports) {
			return this.#rawImports;
		}

		let projectPackageJsonPath = getWorkingProjectPackageJsonPath();
		let packageJson = {};
		if (projectPackageJsonPath) {
			packageJson = importJsonSync(projectPackageJsonPath);
		}

		this.#rawImports = {
			[this.config.keys.package]: packageJson,
		};

		if (this.config.freezeReservedData) {
			DeepFreeze(this.#rawImports);
		}

		return this.#rawImports;
	}

	clearData() {
		this.#globalData = null;
		this.configApiGlobalData = null;
		this.#templateDirectoryData = {};
		this.#dataFileContents = new Map();
		this.#directoryDataPaths = new Map();
	}

	_getGlobalDataGlobByExtension(extension) {
		return TemplateGlob.normalizePath(this.dataDir, `/**/*.${extension}`);
	}

	// This is a backwards compatibility helper with the old `jsDataFileSuffix` configuration API
	getConfigurationDataFileSuffixes() {
		// New API
		if (Array.isArray(this.config.dataFileSuffixes)) {
			return this.config.dataFileSuffixes;
		}

		// Backwards compatibility
		if (this.config.jsDataFileSuffix) {
			let suffixes = [];
			suffixes.push(this.config.jsDataFileSuffix); // e.g. filename.data.json
			suffixes.push(""); // suffix-less for free with old API, e.g. filename.json
			return suffixes;
		}

		return []; // if both of these entries are set to false, use no files
	}

	getAllDataFileSuffixes() {
		let suffixes = this.getConfigurationDataFileSuffixes();
		let suffixesWithExtensions = new Set();
		suffixesWithExtensions.add("json"); // covers .data.json too

		// Typically using [ '.data', '' ] suffixes to find data files
		for (let suffix of suffixes) {
			if (!suffix || typeof suffix !== "string") {
				continue;
			}

			// .suffix.js
			if (suffix.startsWith(".")) {
				suffix = suffix.slice(1);
			}

			suffixesWithExtensions.add(`${suffix || ""}.mjs`);
			suffixesWithExtensions.add(`${suffix || ""}.cjs`);
			suffixesWithExtensions.add(`${suffix || ""}.js`);

			if (isTypeScriptSupported()) {
				suffixesWithExtensions.add(`${suffix || ""}.mts`);
				suffixesWithExtensions.add(`${suffix || ""}.cts`);
				suffixesWithExtensions.add(`${suffix || ""}.ts`);
			}
		}

		// Configuration Data Extensions e.g. yaml
		if (this.hasUserDataExtensions()) {
			for (let extension of this.getUserDataExtensions()) {
				if (extension.startsWith(".")) {
					extension = extension.slice(1);
				}

				suffixesWithExtensions.add(extension); // covers .data.{extension} too
			}
		}

		return suffixesWithExtensions;
	}

	// Converts the legacy suffix and base name options to file name patterns
	#getLegacyDataFileNames() {
		let suffixes = this.getConfigurationDataFileSuffixes();
		let baseName = this.config.dataFileDirBaseNameOverride;
		let template = [];
		let directory = [];

		for (let suffix of suffixes) {
			if (typeof suffix !== "string") {
				continue;
			}

			let filePatterns = suffix
				? [`{name}${suffix}.{js}`, `{name}${suffix}.{ext}`]
				: ["{name}.{ext}"];
			template.push(...filePatterns);

			if (!baseName) {
				directory.push(...filePatterns);
			} else if (suffix) {
				// A base name never matches suffix-less files (#1699)
				directory.push(...filePatterns.map((pattern) => pattern.replace("{name}", baseName)));
			}
		}

		return { template, directory };
	}

	// Patterns are listed highest priority first
	getDataFileNames() {
		return Object.assign(this.#getLegacyDataFileNames(), this.config.dataFileNames);
	}

	// Highest priority first
	#getPatternExtensions(token, isUserPattern) {
		if (token === "js") {
			return this.#eligibleJavaScriptExtensions;
		}

		let extensions = ["json", ...this.getUserDataExtensions()];
		if (!isUserPattern) {
			return extensions;
		}

		// `setDataFileNames` patterns never include extensions that would be imported and executed
		return extensions.filter(
			(extension) => !this.#eligibleJavaScriptExtensions.includes(extension),
		);
	}

	// Legacy patterns converted from `setDataFileSuffixes` keep their original behavior
	#isUserPattern(type) {
		return Boolean(this.config.dataFileNames?.[type]);
	}

	#expandDataFileName(pattern, name, isUserPattern) {
		let fileName = pattern.replaceAll("{name}", name);
		let match = fileName.match(/\{(ext|js)\}/);
		if (!match) {
			return [fileName];
		}

		return this.#getPatternExtensions(match[1], isUserPattern).flatMap((extension) =>
			this.#expandDataFileName(fileName.replace(match[0], extension), name, isUserPattern),
		);
	}

	#pushDataFilePaths(paths, dir, type, name) {
		let isUserPattern = this.#isUserPattern(type);
		for (let pattern of this.getDataFileNames()[type]) {
			if (pattern.includes("{name}") && (!name || name === ".")) {
				continue;
			}
			for (let fileName of this.#expandDataFileName(pattern, name, isUserPattern)) {
				paths.push(dir + "/" + fileName);
			}
		}
	}

	#getDataFileNameGlobs() {
		let names = this.getDataFileNames();
		return unique(
			["template", "directory"].flatMap((type) =>
				names[type].flatMap((pattern) =>
					this.#expandDataFileName(pattern, "*", this.#isUserPattern(type)),
				),
			),
		);
	}

	// Legacy glob format, kept unchanged when `setDataFileNames` is not used
	#getLegacyDataFileGlob(filter = () => true) {
		let suffixes = Array.from(this.getAllDataFileSuffixes()).filter(filter);
		if (suffixes.length === 0) {
			return [];
		}
		return TemplatePath.addLeadingDotSlashArray([`${this.inputDir}**/*.{${suffixes.join(",")}}`]);
	}

	#getDataFileGlob(fileNames) {
		if (fileNames.length === 0) {
			return [];
		}

		let fileGlob = fileNames.length === 1 ? fileNames[0] : `{${fileNames.join(",")}}`;
		return TemplatePath.addLeadingDotSlashArray([`${this.inputDir}**/${fileGlob}`]);
	}

	// This is used exclusively for --watch and --serve chokidar targets
	getTemplateDataFileGlob() {
		if (!this.config.dataFileNames) {
			return this.#getLegacyDataFileGlob();
		}
		return this.#getDataFileGlob(this.#getDataFileNameGlobs());
	}

	// For spidering dependencies
	getTemplateJavaScriptDataFileGlob() {
		let isJavaScript = (fileName) =>
			this.#eligibleJavaScriptExtensions.includes(TemplatePath.getExtension(fileName));
		if (!this.config.dataFileNames) {
			return this.#getLegacyDataFileGlob(isJavaScript);
		}
		return this.#getDataFileGlob(this.#getDataFileNameGlobs().filter(isJavaScript));
	}

	getGlobalDataGlob() {
		let extGlob = this.getGlobalDataExtensionPriorities().join(",");
		return [this._getGlobalDataGlobByExtension("{" + extGlob + "}")];
	}

	getWatchPathCache() {
		return this.pathCache;
	}

	getGlobalDataExtensionPriorities() {
		return this.getUserDataExtensions().concat(this.#globalDataOrderedExtensions);
	}

	static calculateExtensionPriority(path, priorities) {
		let normalized = path.toLowerCase();
		for (let i = 0; i < priorities.length; i++) {
			let ext = priorities[i];
			if (normalized.endsWith(ext)) {
				return i;
			}
		}
		return priorities.length;
	}

	async getGlobalDataFiles() {
		let priorities = this.getGlobalDataExtensionPriorities();

		let fsBench = this.benchmarks.aggregate.get("Searching the file system (data)");
		fsBench.before();
		let globs = this.getGlobalDataGlob();
		let paths = [];
		if (this.fileSystemSearch) {
			paths = await this.fileSystemSearch.search("global-data", globs);
		}
		fsBench.after();

		// sort paths according to extension priorities
		// here we use reverse ordering, because paths with bigger index in array will override the first ones
		// example [path/file.json, path/file.js] here js will override json
		paths = paths.sort((first, second) => {
			let p1 = TemplateData.calculateExtensionPriority(first, priorities);
			let p2 = TemplateData.calculateExtensionPriority(second, priorities);
			if (p1 < p2) {
				return -1;
			}
			if (p1 > p2) {
				return 1;
			}
			return 0;
		});

		this.pathCache = paths;
		return paths;
	}

	getObjectPathForDataFile(dataFilePath) {
		let absoluteDataFilePath = TemplatePath.absolutePath(dataFilePath);
		let reducedPath = TemplatePath.stripLeadingSubPath(absoluteDataFilePath, this.absoluteDataDir);
		let parsed = path.parse(reducedPath);
		let folders = parsed.dir ? parsed.dir.split("/") : [];
		folders.push(parsed.name);

		return folders;
	}

	async getAllGlobalData() {
		let globalData = {};

		let files = TemplatePath.addLeadingDotSlashArray(await this.getGlobalDataFiles());

		this.config.events.emit("buildawesome.globaldatafiles", files);

		let dataFileConflicts = {};

		for (let file of Object.values(files)) {
			let data = await this.getDataValue(file);
			let objectPathTarget = this.getObjectPathForDataFile(file);

			// Since we're joining directory paths and an array is not usable as an objectkey since two identical arrays are not double equal,
			// we can just join the array by a forbidden character ("/"" is chosen here, since it works on Linux, Mac and Windows).
			// If at some point this isn't enough anymore, it would be possible to just use JSON.stringify(objectPathTarget) since that
			// is guaranteed to work but is signifivcantly slower.
			let objectPathTargetString = objectPathTarget.join(path.sep);

			// if two global files have the same path (but different extensions)
			// and conflict, let’s merge them.
			if (dataFileConflicts[objectPathTargetString]) {
				debugWarn(
					`merging global data from ${file} with an already existing global data file (${dataFileConflicts[objectPathTargetString]}). Overriding existing keys.`,
				);

				let oldData = lodashGet(globalData, objectPathTarget);
				data = Merge(oldData, data);
			}

			dataFileConflicts[objectPathTargetString] = file;
			debug(`Found global data file ${file} and adding as: ${objectPathTarget}`);

			lodashSet(globalData, objectPathTarget, data);

			let [key] = objectPathTarget;
			if (!this.#globalDataFilesByKey.has(key)) {
				this.#globalDataFilesByKey.set(key, []);
			}
			this.#globalDataFilesByKey.get(key).push(file);

			if (this.config.freezeReservedData) {
				ReservedData.check(globalData, file);
			}
		}

		return globalData;
	}

	getCoreGlobal() {
		// #2293 for meta[name=generator]
		const pkg = getCorePackageJson();

		let version = coerce(pkg.version).toString();
		let global = {
			version,
			generator: `Eleventy (Build Awesome) v${version}`,
		};
		if (this.environmentVariables) {
			global.env = Object.assign({}, this.environmentVariables);
		}
		if (this.dirs) {
			global.directories = Object.assign({}, this.dirs.getUserspaceInstance());
		}

		if (this.config.freezeReservedData) {
			DeepFreeze(global);
		}

		return global;
	}

	async #getInitialGlobalData() {
		let globalData = await this.initialGlobalData.getData();

		let coreGlobal = this.getCoreGlobal();
		globalData.eleventy = coreGlobal;
		globalData.buildawesome = coreGlobal;

		return globalData;
	}

	async getInitialGlobalData() {
		if (!this.configApiGlobalData) {
			this.configApiGlobalData = this.#getInitialGlobalData();
		}

		return this.configApiGlobalData;
	}

	async #getGlobalData() {
		let rawImports = this.getRawImports();

		// Data from the configuration API eleventyConfig.addGLobalData and `eleventy` global
		let configApiGlobalData = await this.getInitialGlobalData();

		let globalJson = await this.getAllGlobalData();
		let mergedGlobalData = Merge(
			ResolveConfigurationData.normalize(globalJson),
			ResolveConfigurationData.normalize(configApiGlobalData),
		);

		// OK: Shallow merge when combining rawImports (pkg) with global data files
		return Object.assign({}, mergedGlobalData, rawImports);
	}

	// Available after `getGlobalData()`
	getGlobalDataFilesByKey() {
		return this.#globalDataFilesByKey;
	}

	async getGlobalData() {
		if (!this.#globalData) {
			this.#globalData = this.#getGlobalData();
		}

		return this.#globalData;
	}

	/* Template and Directory data files */
	async combineLocalData(localDataPaths) {
		let localData = {};
		if (!Array.isArray(localDataPaths)) {
			localDataPaths = [localDataPaths];
		}

		// Filter out files we know don't exist to avoid overhead for checking
		// June 2026 tested improvement from short-circuiting first match for any file filename.11tydata.cjs would skip remaining filename.11tydata.*
		localDataPaths = localDataPaths.filter((path) => {
			return this.exists(path);
		});

		this.config.events.emit("buildawesome.datafiles", localDataPaths);

		if (!localDataPaths.length) {
			return localData;
		}

		let dataSource = {};
		for (let path of localDataPaths) {
			let dataForPath = await this.getDataValue(path);
			if (!isPlainObject(dataForPath)) {
				debug(
					"Warning: Template and Directory data files expect an object to be returned, instead `%o` returned `%o`",
					path,
					dataForPath,
				);
			} else {
				// clean up data for template/directory data files only.
				let cleanedDataForPath = TemplateData.cleanupData(dataForPath, this.config.keys.tags, {
					file: path,
				});
				for (let key in cleanedDataForPath) {
					if (Object.prototype.hasOwnProperty.call(dataSource, key)) {
						debugWarn(
							"Local data files have conflicting data. Overwriting '%s' with data from '%s'. Previous data location was from '%s'",
							key,
							path,
							dataSource[key],
						);
					}
					dataSource[key] = path;
				}

				Merge(localData, ResolveConfigurationData.normalize(cleanedDataForPath));
			}
		}

		return localData;
	}

	async getTemplateDirectoryData(templatePath) {
		if (!this.#templateDirectoryData[templatePath]) {
			// Data file names match case-insensitively (#4224)
			let existsCache = this.templateConfig.existsCache;
			let localDataPaths = (await this.getLocalDataPaths(templatePath))
				.map((path) => existsCache.resolve(path))
				.filter(Boolean);
			let importedData = await this.combineLocalData(localDataPaths);

			// For incremental builds, a changed data file only affects the templates using it
			this.config.uses?.addDataFiles(templatePath, localDataPaths);

			this.#templateDirectoryData[templatePath] = importedData;
		}

		return this.#templateDirectoryData[templatePath];
	}

	getUserDataExtensions() {
		if (!this.config.dataExtensions) {
			return [];
		}

		// returning extensions in reverse order to create proper extension order
		// later added formats will override first ones
		return Array.from(this.config.dataExtensions.keys()).reverse();
	}

	getUserDataParser(extension) {
		return this.config.dataExtensions.get(extension);
	}

	isUserDataExtension(extension) {
		return this.config.dataExtensions && this.config.dataExtensions.has(extension);
	}

	hasUserDataExtensions() {
		return this.config.dataExtensions && this.config.dataExtensions.size > 0;
	}

	async #parseDataFile(path, parser, options = {}) {
		let readFile = !("read" in options) || options.read === true;
		let rawInput;

		if (readFile) {
			let cacheKey = `${options.encoding}:${path}`;
			rawInput = this.#dataFileContents.get(cacheKey);
			if (rawInput === undefined) {
				rawInput = LoadContent(path, options);
				// Buffers are mutable, so only strings are shared
				if (typeof rawInput === "string") {
					this.#dataFileContents.set(cacheKey, rawInput);
				}
			}
		}

		if (readFile && !rawInput) {
			return {};
		}

		try {
			let result;
			if (readFile) {
				result = parser(rawInput, path);
			} else {
				// path as a first argument is when `read: false`
				// path as a second argument is for consistency with `read: true` API
				result = parser(path, path);
			}

			// Await inside try so async parser rejections are wrapped too
			if (typeof result?.then === "function") {
				return await result;
			}
			return result;
		} catch (e) {
			throw new TemplateDataParseError(`Having trouble parsing data file ${path}`, e).setFilePath(
				path,
			);
		}
	}

	async getDataValue(path) {
		let extension = TemplatePath.getExtension(path).toLowerCase();

		if (this.#eligibleJavaScriptExtensions.includes(extension)) {
			// JS data file or require’d JSON (no preprocessing needed)
			if (!this.exists(path)) {
				return {};
			}

			let aggregateDataBench = this.benchmarks.aggregate.get("Data File");
			aggregateDataBench.before();
			let dataBench = this.benchmarks.data.get(`\`${path}\``);
			dataBench.before();

			let type = "cjs";
			if (
				extension === "mjs" ||
				(extension === "js" && this.isEsm) ||
				extension === "mts" ||
				(extension === "ts" && this.isEsm)
			) {
				type = "esm";
			}

			// We always need to use `import()`, as `require` isn’t available in ESM.
			let returnValue = await DynamicImport(path, type);

			// Returning a function is executed immediately (it has always done this for global data)

			// TODO some API to allow returning a function without executing it immediately
			// (e.g. `permalink.js` or `eleventyDataSchema.js` global data)
			// module.exports = (data) => `${data.page.filePathStem}/`; // Does not work
			// module.exports = () => ((data) => `${data.page.filePathStem}/`); // Works
			if (typeof returnValue === "function") {
				let configApiGlobalData = await this.getInitialGlobalData();
				try {
					returnValue = await returnValue(configApiGlobalData || {});
				} catch (e) {
					if (this.config.freezeReservedData && ReservedData.isFrozenError(e)) {
						throw ReservedData.getError({ cause: e, sourceLocation: path });
					}
					throw e;
				}
			}

			dataBench.after();
			aggregateDataBench.after();

			return returnValue;
		} else if (this.isUserDataExtension(extension)) {
			// Other extensions
			let { parser, options } = this.getUserDataParser(extension);

			let returnValue = this.#parseDataFile(path, parser, options);

			return returnValue;
		} else if (extension === "json") {
			// File to string, parse with JSON (preprocess)
			let returnValue = this.#parseDataFile(path, (content) => JSON.parse(content));

			return returnValue;
		} else {
			throw new TemplateDataParseError(
				`Could not find an appropriate data parser for ${path}. Do you need to add a plugin to your config file?`,
			);
		}
	}

	async getLocalDataPaths(templatePath) {
		let paths = [];
		let parsed = path.parse(templatePath);

		if (parsed.dir) {
			let fileNameNoExt = this.extensionMap.removeTemplateExtension(parsed.base);

			debug("Using %o patterns to find template data files.", this.getDataFileNames().template);
			this.#pushDataFilePaths(paths, parsed.dir, "template", fileNameNoExt);

			paths.push(...this.#getDirectoryDataPaths(parsed.dir));
		}

		debug("getLocalDataPaths(%o): %o", templatePath, paths);
		return unique(paths).reverse();
	}

	// Shared by every template in the directory
	#getDirectoryDataPaths(parsedDir) {
		let cached = this.#directoryDataPaths.get(parsedDir);
		if (cached) {
			return cached;
		}

		let paths = [];
		let inputDir = this.inputDir;

		for (let dir of TemplatePath.getAllDirs(parsedDir)) {
			// TODO use DirContains
			if (!inputDir || (dir.startsWith(inputDir) && dir !== inputDir)) {
				this.#pushDataFilePaths(paths, dir, "directory", TemplatePath.getLastPathSegment(dir));
			}
		}

		// 0.11.0+ include root input dir files, e.g. docs/docs.json for a `docs/` input dir
		if (inputDir) {
			let rootDir = TemplatePath.getDirFromFilePath(
				TemplatePath.addLeadingDotSlash(
					TemplatePath.join(inputDir, TemplatePath.getLastPathSegment(inputDir)),
				),
			);
			this.#pushDataFilePaths(
				paths,
				rootDir,
				"directory",
				TemplatePath.getLastPathSegment(inputDir),
			);
		}

		this.#directoryDataPaths.set(parsedDir, paths);
		return paths;
	}

	/* Like cleanupData() but does not mutate */
	static getCleanedTagsImmutable(data, tagsKey = TemplateData.DEFAULT_TAGS_KEY, options = {}) {
		let tags = [];

		if (tagsKey && isPlainObject(data) && data[tagsKey]) {
			let value = data[tagsKey];
			if (typeof value === "string") {
				tags = value.split(",");
			} else if (Array.isArray(value)) {
				tags = value;
			} else {
				throw new Error(
					`String or Array expected for \`${tagsKey}\`${options.file ? ` in ${options.isVirtualTemplate ? "virtual " : ""}template: ${options.file}` : ""}. Received: ${inspect(value)}`,
				);
			}

			// Deduplicate tags
			// Coerce to string #3875
			return [...new Set(tags)].map((entry) => String(entry));
		}

		return tags;
	}

	static cleanupData(data, tagsKey = TemplateData.DEFAULT_TAGS_KEY, options = {}) {
		if (tagsKey && isPlainObject(data) && tagsKey in data) {
			data[tagsKey] = this.getCleanedTagsImmutable(data, tagsKey, options);
		}

		return data;
	}

	static getNormalizedExcludedCollections(data) {
		let excludes = [];
		let excludeValue = ResolveConfigurationData.getValue(
			data,
			ResolveConfigurationData.EXCLUDE_FROM_COLLECTIONS_KEY,
		);
		if (excludeValue !== true) {
			if (Array.isArray(excludeValue)) {
				excludes = excludeValue;
			} else if (typeof excludeValue === "string") {
				excludes = (excludeValue || "").split(",");
			}
		}

		return {
			excludes,
			excludeAll: excludeValue === true,
		};
	}

	static getIncludedCollectionNames(data, tagsKey = TemplateData.DEFAULT_TAGS_KEY) {
		let tags = TemplateData.getCleanedTagsImmutable(data, tagsKey);

		let { excludes, excludeAll } = TemplateData.getNormalizedExcludedCollections(data);
		if (excludeAll) {
			return [];
		}

		return ["all", ...tags].filter((tag) => !excludes.includes(tag));
	}

	static getIncludedTagNames(data, tagsKey = TemplateData.DEFAULT_TAGS_KEY) {
		return this.getIncludedCollectionNames(data, tagsKey).filter((tagName) => tagName !== "all");
	}
}

export default TemplateData;
