import { TemplatePath } from "@11ty/eleventy-utils";

// Direct reference to avoid use of `browser` Nunjucks variant in bundles
import {
	default as NunjucksLib,
	Environment,
	FileSystemLoader,
	Template,
} from "@11ty/nunjucks/index.js";
import TemplateEngine from "./TemplateEngine.js";
import BaseError from "../Errors/BaseError.js";
import { augmentObject } from "./Util/ContextAugmenter.js";
import { createDebug } from "../Util/DebugLogUtil.js";

const debug = createDebug("Nunjucks");

class BuildAwesomeNunjucksError extends BaseError {}

export default class Nunjucks extends TemplateEngine {
	constructor(name, eleventyConfig) {
		super(name, eleventyConfig);

		this.nunjucksEnvironmentOptions = this.config.nunjucksEnvironmentOptions || { dev: true };

		this.nunjucksPrecompiledTemplates = this.config.nunjucksPrecompiledTemplates || {};
		this._usingPrecompiled = Object.keys(this.nunjucksPrecompiledTemplates).length > 0;

		this.setLibrary(this.config.libraryOverrides.njk);
	}

	// v3.1.0-alpha.1 we’ve moved to use Nunjucks’ internal cache instead of Eleventy’s
	// get cacheable() {
	// 	return false;
	// }

	#getFileSystemDirs() {
		let paths = new Set();
		paths.add(super.getIncludesDir());
		paths.add(TemplatePath.getWorkingDir());

		// Filter out undefined paths
		return Array.from(paths).filter(Boolean);
	}

	#setEnv(override) {
		if (override) {
			this.njkEnv = override;
		} else if (this._usingPrecompiled) {
			// Precompiled templates to avoid eval!
			const NodePrecompiledLoader = function () {};

			NodePrecompiledLoader.prototype.getSource = (name) => {
				// https://github.com/mozilla/nunjucks/blob/fd500902d7c88672470c87170796de52fc0f791a/nunjucks/src/precompiled-loader.js#L5
				return {
					src: {
						type: "code",
						obj: this.nunjucksPrecompiledTemplates[name],
					},
					// Maybe add this?
					// path,
					// noCache: true
				};
			};

			this.njkEnv = new Environment(new NodePrecompiledLoader(), this.nunjucksEnvironmentOptions);
		} else {
			let loaders = [];
			loaders.push(new FileSystemLoader(this.#getFileSystemDirs()));

			// These need to come after FileSystemLoader
			for (let loaderOptions of this.config.nunjucksLoaders) {
				let loader = NunjucksLib.Loader.extend(loaderOptions);
				loaders.push(new loader());
			}

			this.njkEnv = new Environment(loaders, this.nunjucksEnvironmentOptions);
		}

		this.config.events.emit("buildawesome.engine.njk", {
			nunjucks: NunjucksLib,
			environment: this.njkEnv,
		});
	}

	setLibrary(override) {
		this.#setEnv(override);

		// Note that a new Nunjucks engine instance is created for subsequent builds
		// Eleventy Nunjucks is set to `cacheable` false above to opt out of Eleventy cache
		this.config.events.on("buildawesome#templatemodified", (templatePath) => {
			// NunjucksEnvironment:
			// loader.pathToNames: {'ABSOLUTE_PATH/src/_includes/components/possum-home.css': 'components/possum-home.css'}
			// loader.cache: { 'components/possum-home.css': [Template] }
			// Nunjucks stores these as Operating System native paths
			let absTmplPath = TemplatePath.normalizeOperatingSystemFilePath(
				TemplatePath.absolutePath(templatePath),
			);
			for (let loader of this.njkEnv.loaders) {
				let nunjucksName = loader.pathsToNames[absTmplPath];
				if (nunjucksName) {
					debug(
						"Match found in Nunjucks cache via templateModified for %o, clearing this entry",
						templatePath,
					);
					delete loader.pathsToNames[absTmplPath];
					delete loader.cache[nunjucksName];
				}
			}

			// Behavior prior to v3.1.0-alpha.1:
			// this.njkEnv.invalidateCache();
		});

		this.setEngineLib(this.njkEnv, Boolean(this.config.libraryOverrides.njk));

		this.addFilters(this.config.nunjucksFilters);
		this.addFilters(this.config.nunjucksAsyncFilters, true);

		// Changed from sync to async function in v4.0.0-alpha.9 (notably previous versions of synchronous paired shortcodes used CallExtensionAsync)
		// Deprecated in v4.0.0-alpha.9. Use `{% set %}` which is now async-friendly
		this.addPairedShortcode(
			"setAsync",
			async function (content, variableName) {
				this.ctx[variableName] = content;
				return "";
			},
			true,
		);

		this.addCustomTags(this.config.nunjucksTags);
		this.addAllShortcodes(this.config.nunjucksShortcodes);
		this.addAllShortcodes(this.config.nunjucksAsyncShortcodes, true);
		this.addAllPairedShortcodes(this.config.nunjucksPairedShortcodes);
		this.addAllPairedShortcodes(this.config.nunjucksAsyncPairedShortcodes, true);
		this.addGlobals(this.config.nunjucksGlobals);
	}

	addFilters(filters, isAsync) {
		for (let name in filters) {
			this.njkEnv.addFilter(name, Nunjucks.wrapFilter(name, filters[name]), isAsync);
		}
	}

	static wrapFilter(name, fn) {
		return function (...args) {
			try {
				augmentObject(this, {
					source: this.ctx,
					lazy: false, // context.env?.opts.throwOnUndefined,
				});

				return fn.call(this, ...args);
			} catch (e) {
				throw new BuildAwesomeNunjucksError(
					`Error in Nunjucks Filter \`${name}\`${this.page ? ` (${this.page.inputPath})` : ""}`,
					e,
				);
			}
		};
	}

	// Shortcodes
	static normalizeContext(context) {
		let obj = {};
		if (context.ctx) {
			obj.ctx = context.ctx;
			obj.env = context.env;

			augmentObject(obj, {
				source: context.ctx,
				lazy: false, // context.env?.opts.throwOnUndefined,
			});
		}
		return obj;
	}

	addCustomTags(tags) {
		for (let name in tags) {
			this.addTag(name, tags[name]);
		}
	}

	addTag(name, tagFn) {
		let tagObj;
		if (typeof tagFn === "function") {
			tagObj = tagFn(NunjucksLib, this.njkEnv);
		} else {
			throw new Error(
				"Nunjucks.addTag expects a callback function to be passed in: addTag(name, function(nunjucksEngine) {})",
			);
		}

		this.njkEnv.addExtension(name, tagObj);
	}

	addGlobals(globals) {
		for (let name in globals) {
			this.addGlobal(name, globals[name]);
		}
	}

	addGlobal(name, globalFn) {
		this.njkEnv.addGlobal(name, globalFn);
	}

	addAllShortcodes(shortcodes, isAsync = false) {
		for (let name in shortcodes) {
			this.addShortcode(name, shortcodes[name], isAsync);
		}
	}

	addAllPairedShortcodes(shortcodes, isAsync = false) {
		for (let name in shortcodes) {
			this.addPairedShortcode(name, shortcodes[name], isAsync);
		}
	}

	_getShortcodeFn(shortcodeName, shortcodeFn) {
		return function ShortcodeFunction() {
			this.tags = [shortcodeName];

			this.parse = function (parser, nodes) {
				let tok = parser.nextToken();
				let args = parser.parseSignature(true, true);

				// Nunjucks bug with non-paired custom tags bug still exists even
				// though this issue is closed. Works fine for paired.
				// https://github.com/mozilla/nunjucks/issues/158
				// https://github.com/11ty/eleventy/issues/372

				// v4.0.0-alpha.1 changed from an empty string to an empty NodeList
				// https://github.com/11ty/eleventy/issues/3788

				// v4.0.0-alpha.9 fixed the issue upstream in Nunjucks core.

				parser.advanceAfterBlockEnd(tok.value);

				return new nodes.CallExtensionAsync(this, "run", args, null);
			};

			this.run = function (...args) {
				let resolve = args.pop();
				let [context, ...argArray] = args;

				let ret;

				try {
					ret = shortcodeFn.call(Nunjucks.normalizeContext(context), ...argArray);
				} catch (e) {
					resolve(
						new BuildAwesomeNunjucksError(`Error with Nunjucks shortcode \`${shortcodeName}\``, e),
					);
				}

				// v4.0.0-alpha.9: reverts #3286 error messaging when the shortcode is not a promise to return content
				if (!ret?.then) {
					resolve(null, new NunjucksLib.runtime.SafeString("" + ret));
					return;
				}

				ret.then(
					function (returnValue) {
						resolve(null, new NunjucksLib.runtime.SafeString("" + returnValue));
					},
					function (e) {
						resolve(
							new BuildAwesomeNunjucksError(
								`Error with Nunjucks shortcode \`${shortcodeName}\``,
								e,
							),
						);
					},
				);
			};
		};
	}

	_getPairedShortcodeFn(shortcodeName, shortcodeFn) {
		return function PairedShortcodeFunction() {
			this.tags = [shortcodeName];

			this.parse = function (parser, nodes) {
				var tok = parser.nextToken();

				var args = parser.parseSignature(true, true);
				parser.advanceAfterBlockEnd(tok.value);

				var body = parser.parseUntilBlocks("end" + shortcodeName);
				parser.advanceAfterBlockEnd();

				return new nodes.CallExtensionAsync(this, "run", args, [body]);
			};

			this.run = function (...args) {
				let resolve = args.pop();
				let body = args.pop();
				let [context, ...argArray] = args;

				body(function (e, bodyContent) {
					if (e) {
						resolve(
							new BuildAwesomeNunjucksError(
								`Error with Nunjucks paired shortcode \`${shortcodeName}\``,
								e,
							),
						);
					}

					let ret;

					try {
						ret = shortcodeFn.call(Nunjucks.normalizeContext(context), bodyContent, ...argArray);
					} catch (e) {
						resolve(
							new BuildAwesomeNunjucksError(
								`Error with Nunjucks paired shortcode \`${shortcodeName}\``,
								e,
							),
						);
					}

					// #3286 error messaging when the shortcode is not a promise
					// v4.0.0-alpha.9 swapped to handle silently (async-everything)
					if (!ret?.then) {
						resolve(null, new NunjucksLib.runtime.SafeString("" + ret));
						return;
					}

					ret.then(
						function (returnValue) {
							resolve(null, new NunjucksLib.runtime.SafeString("" + returnValue));
						},
						function (e) {
							resolve(
								new BuildAwesomeNunjucksError(
									`Error with Nunjucks paired shortcode \`${shortcodeName}\``,
									e,
								),
							);
						},
					);
				});
			};
		};
	}

	addShortcode(shortcodeName, shortcodeFn, isAsync = false) {
		let fn = this._getShortcodeFn(shortcodeName, shortcodeFn, isAsync);
		this.njkEnv.addExtension(shortcodeName, new fn());
	}

	addPairedShortcode(shortcodeName, shortcodeFn, isAsync = false) {
		let fn = this._getPairedShortcodeFn(shortcodeName, shortcodeFn, isAsync);
		this.njkEnv.addExtension(shortcodeName, new fn());
	}

	// Don’t return a boolean if permalink is a function (see TemplateContent->renderPermalink)
	permalinkNeedsCompilation(str) {
		if (typeof str === "string") {
			return this.needsCompilation(str);
		}
	}

	needsCompilation(str) {
		// Defend against syntax customisations:
		//    https://mozilla.github.io/nunjucks/api.html#customizing-syntax
		let optsTags = this.njkEnv.opts.tags || {};
		let blockStart = optsTags.blockStart || "{%";
		let variableStart = optsTags.variableStart || "{{";
		let commentStart = optsTags.variableStart || "{#";

		return (
			str.indexOf(blockStart) !== -1 ||
			str.indexOf(variableStart) !== -1 ||
			str.indexOf(commentStart) !== -1
		);
	}

	_getParseExtensions() {
		if (this._parseExtensions) {
			return this._parseExtensions;
		}

		// add extensions so the parser knows about our custom tags/blocks
		let ext = [];
		for (let name in this.config.nunjucksTags) {
			let fn = this._getShortcodeFn(name, () => {});
			ext.push(new fn());
		}
		for (let name in this.config.nunjucksShortcodes) {
			let fn = this._getShortcodeFn(name, () => {});
			ext.push(new fn());
		}
		for (let name in this.config.nunjucksAsyncShortcodes) {
			let fn = this._getShortcodeFn(name, () => {}, true);
			ext.push(new fn());
		}
		for (let name in this.config.nunjucksPairedShortcodes) {
			let fn = this._getPairedShortcodeFn(name, () => {});
			ext.push(new fn());
		}
		for (let name in this.config.nunjucksAsyncPairedShortcodes) {
			let fn = this._getPairedShortcodeFn(name, () => {}, true);
			ext.push(new fn());
		}

		this._parseExtensions = ext;
		return ext;
	}

	/* Outputs an Array of lodash get selectors */
	parseForSymbols(str) {
		if (!str) {
			return [];
		}
		const { parser, nodes } = NunjucksLib;
		let obj = parser.parse(str, this._getParseExtensions());
		if (!obj) {
			return [];
		}
		let linesplit = str.split("\n");
		let values = obj.findAll(nodes.Value);
		let symbols = obj.findAll(nodes.Symbol).map((entry) => {
			let name = [entry.value];
			let nestedIndex = -1;
			for (let val of values) {
				if (nestedIndex > -1) {
					/* deep.object.syntax */
					if (linesplit[val.lineno].charAt(nestedIndex) === ".") {
						name.push(val.value);
						nestedIndex += val.value.length + 1;
					} else {
						nestedIndex = -1;
					}
				} else if (
					val.lineno === entry.lineno &&
					val.colno === entry.colno &&
					val.value === entry.value
				) {
					nestedIndex = entry.colno + entry.value.length;
				}
			}
			return name.join(".");
		});

		let uniqueSymbols = Array.from(new Set(symbols));
		return uniqueSymbols;
	}

	async compile(str, inputPath) {
		let tmpl;

		// *All* templates are precompiled to avoid runtime eval
		if (this._usingPrecompiled) {
			tmpl = this.njkEnv.getTemplate(str, true);
		} else if (!inputPath || inputPath === "njk" || inputPath === "md") {
			// Template(content, environment, path, eagerCompile)
			tmpl = new Template(str, this.njkEnv, null, false);
		} else {
			// Template(content, environment, path, eagerCompile)
			tmpl = new Template(str, this.njkEnv, inputPath, false);
		}

		return function (data) {
			let { promise, resolve, reject } = Promise.withResolvers();

			tmpl.render(data, (error, result) => {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			});

			return promise;
		};
	}
}
