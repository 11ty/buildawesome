import fullBundleDefaultConfig from "./defaultConfigExtended.js";
import TransformsUtil from "./Util/TransformsUtil.js";

/**
 * @module 11ty/eleventy/defaultConfig
 */

/**
 * @callback addFilter - Register a global filter.
 * @param {string} name - Register a template filter by this name.
 * @param {function} callback - The filter logic.
 */

/**
 * @typedef {object} config
 * @property {addFilter} addFilter - Register a new global filter.
 * @property {addPlugin} addPlugin - Execute or defer a plugin’s execution.
 * @property {addTransform} addTransform - Add an Eleventy transform to postprocess template output
 */

/**
 * @typedef {object} defaultConfig
 * @property {Array<string>} templateFormats - An array of accepted template formats.
 * @property {Array<string>} dataFileSuffixes - Array of file suffixes for data files in the Data Cascade.
 * @property {boolean} [dataFileDirBaseNameOverride=false] - Use index.* instead of dirname.* for Directory Data File names
 * @property {string} [pathPrefix='/'] - The directory under which all output files should be written to.
 * @property {string} [markdownTemplateEngine='liquid'] - Template engine to process markdown files with.
 * @property {string} [htmlTemplateEngine='liquid'] - Template engine to process html files with.
 * @property {boolean} [dataTemplateEngine=false] - Changed in v1.0
 * @property {object} keys
 * @property {string} [keys.package='pkg'] - Global data property for package.json data
 * @property {string} [keys.layout='layout']
 * @property {string} [keys.permalink='permalink']
 * @property {string} [keys.permalinkRoot='permalinkBypassOutputDir']
 * @property {string} [keys.engineOverride='templateEngineOverride']
 * @property {string} [keys.computed='buildawesomeComputed']
 * @property {string} [keys.dataSchema='buildawesomeDataSchema']
 * @property {object} dir
 * @property {string} [dir.input='.']
 * @property {string} [dir.includes='_includes']
 * @property {string} [dir.data='_data']
 * @property {string} [dir.output='_site']
 * @deprecated handlebarsHelpers
 * @deprecated nunjucksFilters
 */

/**
 * Default configuration object factory.
 *
 * @param {config} config - Eleventy configuration object.
 * @returns {defaultConfig}
 */
export default function (config) {
	// add extra config (not available in `@11ty/client` bundle)
	fullBundleDefaultConfig.call(this, config);

	config.addFilter("log", (input, ...messages) => {
		const allEntries = [input, ...messages];
		if(allEntries.some(entry => entry instanceof Promise)) {
			// If any entry is a Promise, we switch to async bahavior.
			// Async bahvior means that we return a Promise and await all entries before logging them to
			// avoid logs of "Promise {pending}".
			// After all entries are resolved and logged, the returned Promise resolves to the input value.

			// additional Promise wrapper to only resolve to the original input value
			return new Promise((res, rej) => {
				Promise.all(allEntries).then(resolvedEntries => {
					console.log(...resolvedEntries);
					// We can resolve to the original input argument safely here.
					res(input);
				}).catch(e => rej(e))
			})
		} else {
			// if all entries are sync, log them normally and return `input`
			console.log(...allEntries);
			return input;
		}
	});

	// Process arbitrary content with transforms
	config.addFilter(
		"renderTransforms",
		async function transformsFilter(content, pageEntryOverride, baseHrefOverride) {
			return TransformsUtil.runAll(content, pageEntryOverride || this.page, config.transforms, {
				baseHrefOverride,
				logger: config.logger,
			});
		},
	);

	return {
		templateFormats: ["liquid", "md", "njk", "html", "11ty.js"],

		// to add a parent directory structure to URLs (not reflected on the file system), change this
		pathPrefix: "/",
		markdownTemplateEngine: "liquid",
		htmlTemplateEngine: "liquid",

		// Renamed from `jsDataFileSuffix` in 2.0 (and swapped to an Array)
		// If you remove "" we won’t look for dir/dir.json or file.json
		dataFileSuffixes: [".data", ".11tydata", ""],

		// "index" will look for `directory/index.*` directory data files instead of `directory/directory.*`
		dataFileDirBaseNameOverride: false,

		keys: {
			// TODO breaking: use `false` by default
			package: "pkg", // supports `false`
			layout: "layout",
			permalink: "permalink",
			permalinkRoot: "permalinkBypassOutputDir",
			engineOverride: "templateEngineOverride",
			computed: "buildawesomeComputed",
			dataSchema: "buildawesomeDataSchema",
			import: "buildawesomeImport",
		},

		// Deprecated, define using `export const directories = {}` instead.
		// Reference values using `eleventyConfig.directories` instead.
		dir: {
			// These values here aren’t used internally either (except by a few tests), instead we’re using `ProjectDirectories.defaults`.
			// These are kept in place for backwards compat with `eleventyConfig.dir` references in project config code and plugins.
			input: ".",
			includes: "_includes",
			data: "_data",
			output: "_site",
		},

		// deprecated, use config.addNunjucksFilter
		nunjucksFilters: {},
	};
}
