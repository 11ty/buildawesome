import { bcp47Normalize } from "bcp-47-normalize";
import iso639 from "iso-639-1";
import { DeepCopy } from "@11ty/eleventy-utils";

// pathPrefix note:
// When using `locale_url` filter with the `url` filter, `locale_url` must run first like
// `| locale_url | url`. If you run `| url | locale_url` it won’t match correctly.

// TODO improvement would be to throw an error if `locale_url` finds a url with the
// path prefix at the beginning? Would need a better way to know `url` has transformed a string
// rather than just raw comparison.
// e.g. --pathprefix=/en/ should return `/en/en/` for `/en/index.liquid`

class LangUtils {
	static getLanguageCodeFromInputPath(filepath) {
		return (filepath || "").split("/").find((entry) => Comparator.isLangCode(entry));
	}

	static getLanguageCodeFromUrl(url) {
		let s = (url || "").split("/");
		return s.length > 0 && Comparator.isLangCode(s[1]) ? s[1] : "";
	}

	static swapLanguageCodeNoCheck(str, langCode) {
		let found = false;
		return str
			.split("/")
			.map((entry) => {
				// only match the first one
				if (!found && Comparator.isLangCode(entry)) {
					found = true;
					return langCode;
				}
				return entry;
			})
			.join("/");
	}

	static swapLanguageCode(str, langCode) {
		if (!Comparator.isLangCode(langCode)) {
			return str;
		}

		return LangUtils.swapLanguageCodeNoCheck(str, langCode);
	}
}

class Comparator {
	// https://en.wikipedia.org/wiki/IETF_language_tag#Relation_to_other_standards
	// Requires a ISO-639-1 language code at the start (2 characters before the first -)
	static isLangCode(code) {
		let [s] = (code || "").split("-");
		if (!iso639.validate(s)) {
			return false;
		}
		if (!bcp47Normalize(code)) {
			return false;
		}
		return true;
	}

	static urlHasLangCode(url, code) {
		if (!Comparator.isLangCode(code)) {
			return false;
		}

		return url.split("/").some((entry) => entry === code);
	}
}

function normalizeInputPath(inputPath, extensionMap) {
	if (extensionMap) {
		return extensionMap.removeTemplateExtension(inputPath);
	}
	return inputPath;
}

/*
 * Input: {
 *   '/en-us/test/': './test/stubs-i18n/en-us/test.11ty.js',
 *   '/en/test/': './test/stubs-i18n/en/test.liquid',
 *   '/es/test/': './test/stubs-i18n/es/test.njk',
 *   '/non-lang-file/': './test/stubs-i18n/non-lang-file.njk'
 * }
 *
 * Output: {
 *   '/en-us/test/': [ { url: '/en/test/' }, { url: '/es/test/' } ],
 *   '/en/test/': [ { url: '/en-us/test/' }, { url: '/es/test/' } ],
 *   '/es/test/': [ { url: '/en-us/test/' }, { url: '/en/test/' } ]
 * }
 */
function getLocaleUrlsMap(urlToInputPath, extensionMap, options = {}) {
	let filemap = {};

	for (let url in urlToInputPath) {
		// Group number comes from Pagination.js
		let { inputPath: originalFilepath, groupNumber } = urlToInputPath[url];
		let filepath = normalizeInputPath(originalFilepath, extensionMap);
		let replaced =
			LangUtils.swapLanguageCodeNoCheck(filepath, "__11ty_i18n") + `_group:${groupNumber}`;

		if (!filemap[replaced]) {
			filemap[replaced] = [];
		}

		let langCode = LangUtils.getLanguageCodeFromInputPath(originalFilepath);
		if (!langCode) {
			langCode = LangUtils.getLanguageCodeFromUrl(url);
		}
		if (!langCode) {
			langCode = options.defaultLanguage;
		}

		if (langCode) {
			filemap[replaced].push({
				url,
				lang: langCode,
				label: iso639.getNativeName(langCode.split("-")[0]),
			});
		} else {
			filemap[replaced].push({ url });
		}
	}

	// Default sorted by lang code
	for (let key in filemap) {
		filemap[key].sort(function (a, b) {
			if (a.lang < b.lang) {
				return -1;
			}
			if (a.lang > b.lang) {
				return 1;
			}
			return 0;
		});
	}

	// map of input paths => array of localized urls
	let urlMap = {};
	for (let filepath in filemap) {
		for (let entry of filemap[filepath]) {
			let url = entry.url;
			if (!urlMap[url]) {
				urlMap[url] = filemap[filepath].filter((entry) => {
					if (entry.lang) {
						return true;
					}
					return entry.url !== url;
				});
			}
		}
	}

	return urlMap;
}

function I18nPlugin(eleventyConfig, opts = {}) {
	let options = DeepCopy(
		{
			defaultLanguage: "",
			filters: {
				url: "locale_url",
				links: "locale_links",
			},
			errorMode: "strict", // allow-fallback, never
		},
		opts,
	);

	if (!options.defaultLanguage) {
		throw new Error(
			"You must specify a `defaultLanguage` in Eleventy’s Internationalization (I18N) plugin.",
		);
	}

	let extensionMap;
	eleventyConfig.on("buildawesome.extensionmap", (map) => {
		extensionMap = map;
	});

	let bench = eleventyConfig.benchmarkManager.get("Aggregate");
	let contentMaps = {};
	eleventyConfig.on("buildawesome.contentmap", function ({ urlToInputPath, inputPathToUrl }) {
		let b = bench.get("(i18n Plugin) Setting up content map.");
		b.before();
		contentMaps.inputPathToUrl = inputPathToUrl;
		contentMaps.urlToInputPath = urlToInputPath;

		contentMaps.localeUrlsMap = getLocaleUrlsMap(urlToInputPath, extensionMap, options);
		b.after();
	});

	eleventyConfig.addGlobalData("eleventyComputed.page.lang", () => {
		// if addGlobalData receives a function it will execute it immediately,
		// so we return a nested function for computed data
		return (data) => {
			return LangUtils.getLanguageCodeFromUrl(data.page.url) || options.defaultLanguage;
		};
	});

	// Normalize a theoretical URL based on the current page’s language
	// If a non-localized file exists, returns the URL without a language assigned
	// Fails if no file exists (localized and not localized)
	eleventyConfig.addFilter(options.filters.url, function (url, langCodeOverride) {
		let langCode =
			langCodeOverride ||
			LangUtils.getLanguageCodeFromUrl(this.page?.url) ||
			options.defaultLanguage;

		// Already has a language code on it and has a relevant url with the target language code
		if (
			contentMaps.localeUrlsMap[url] ||
			(!url.endsWith("/") && contentMaps.localeUrlsMap[`${url}/`])
		) {
			for (let existingUrlObj of contentMaps.localeUrlsMap[url] ||
				contentMaps.localeUrlsMap[`${url}/`]) {
				if (Comparator.urlHasLangCode(existingUrlObj.url, langCode)) {
					return existingUrlObj.url;
				}
			}
		}

		// Needs the language code prepended to the URL
		let prependedLangCodeUrl = `/${langCode}${url}`;
		if (
			contentMaps.localeUrlsMap[prependedLangCodeUrl] ||
			(!prependedLangCodeUrl.endsWith("/") && contentMaps.localeUrlsMap[`${prependedLangCodeUrl}/`])
		) {
			return prependedLangCodeUrl;
		}

		if (
			contentMaps.urlToInputPath[url] ||
			(!url.endsWith("/") && contentMaps.urlToInputPath[`${url}/`])
		) {
			// this is not a localized file (independent of a language code)
			if (options.errorMode === "strict") {
				throw new Error(
					`Localized file for URL ${prependedLangCodeUrl} was not found in your project. A non-localized version does exist—are you sure you meant to use the \`${options.filters.url}\` filter for this? You can bypass this error using the \`errorMode\` option in the I18N plugin (current value: "${options.errorMode}").`,
				);
			}
		} else if (options.errorMode === "allow-fallback") {
			// You’re linking to a localized file that doesn’t exist!
			throw new Error(
				`Localized file for URL ${prependedLangCodeUrl} was not found in your project! You will need to add it if you want to link to it using the \`${options.filters.url}\` filter. You can bypass this error using the \`errorMode\` option in the I18N plugin (current value: "${options.errorMode}").`,
			);
		}

		return url;
	});

	// Refactor to use url
	// Find the links that are localized alternates to the inputPath argument
	eleventyConfig.addFilter(options.filters.links, function (urlOverride) {
		let url = urlOverride || this.page?.url;
		return (contentMaps.localeUrlsMap[url] || []).filter((entry) => {
			return entry.url !== url;
		});
	});

	// Returns a `page`-esque variable for the root default language page
	// If paginated, returns first result only
	eleventyConfig.addFilter(
		"locale_page", // This is not exposed in `options` because it is an Eleventy internals filter (used in get*CollectionItem filters)
		function (pageOverride, languageCode) {
			// both args here are optional
			if (!languageCode) {
				languageCode = options.defaultLanguage;
			}

			let page = pageOverride || this.page;
			let url; // new url
			if (contentMaps.localeUrlsMap[page.url]) {
				for (let entry of contentMaps.localeUrlsMap[page.url]) {
					if (entry.lang === languageCode) {
						url = entry.url;
					}
				}
			}

			let inputPath = LangUtils.swapLanguageCode(page.inputPath, languageCode);

			if (
				!url ||
				!Array.isArray(contentMaps.inputPathToUrl[inputPath]) ||
				contentMaps.inputPathToUrl[inputPath].length === 0
			) {
				// no internationalized pages found
				return page;
			}

			let result = {
				// // note that the permalink/slug may be different for the localized file!
				url,
				inputPath,
				filePathStem: LangUtils.swapLanguageCode(page.filePathStem, languageCode),
				// outputPath is omitted here, not necessary for GetCollectionItem.js if url is provided
				__locale_page_resolved: true,
			};
			return result;
		},
	);
}

export { Comparator, LangUtils };

Object.defineProperty(I18nPlugin, "eleventyPackage", {
	value: "@11ty/eleventy/i18n-plugin",
});

Object.defineProperty(I18nPlugin, "eleventyPluginOptions", {
	value: {
		unique: true,
	},
});

// CommonJS friendly exports on .default
Object.assign(I18nPlugin, {
	Comparator,
	LangUtils,
});

export default I18nPlugin;
