import { TemplatePath } from "@11ty/eleventy-utils";

import { isGlobMatch } from "./GlobMatcher.js";

// Not a plain object, so the data cascade keeps it by reference instead of merging into it
class TemplateQueryResult {}

function isObject(value) {
	return (typeof value === "object" && value !== null) || typeof value === "function";
}

// Before results exist, property reads (e.g. destructuring in front matter) return another lazy value for that path
function createLazyProxy(resolve, isReady) {
	return new Proxy(new TemplateQueryResult(), {
		get(target, prop) {
			// Never a thenable, so awaiting data doesn’t resolve it early
			if (prop === "then") {
				return undefined;
			}
			if (!isReady()) {
				return createLazyProxy(() => resolve()?.[prop], isReady);
			}

			let resolved = resolve();
			// A deferred path can end in a primitive (e.g. a string), which is unwrapped when output
			if (!isObject(resolved)) {
				if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") {
					return () => resolved;
				}
				return resolved?.[prop];
			}
			let value = Reflect.get(resolved, prop, resolved);
			return typeof value === "function" ? value.bind(resolved) : value;
		},
		has(target, prop) {
			let resolved = resolve();
			return isObject(resolved) && Reflect.has(resolved, prop);
		},
		ownKeys() {
			let resolved = resolve();
			return isObject(resolved) ? Reflect.ownKeys(resolved) : [];
		},
		getOwnPropertyDescriptor(target, prop) {
			let resolved = resolve();
			let descriptor = isObject(resolved)
				? Reflect.getOwnPropertyDescriptor(resolved, prop)
				: undefined;
			// Proxy invariants forbid reporting non-configurable properties the target doesn’t have
			return descriptor ? { ...descriptor, configurable: true } : undefined;
		},
	});
}

// Called before results exist, these are recorded and replayed on each fill
const DEFERRED_METHODS = ["filter", "map", "slice", "toReversed", "toSorted"];
const DEFERRED_IN_PLACE_METHODS = ["reverse", "sort"];

// QueryResults => { ops, filled, derive }
const resultsState = new WeakMap();

class QueryResults extends Array {
	// Built-in methods on filled results return plain arrays
	static get [Symbol.species]() {
		return Array;
	}

	static fill(results, pages) {
		let state = resultsState.get(results);
		let items = state.ops.reduce(
			(arr, [method, args]) => Array.prototype[method].apply(arr, args),
			pages.slice(),
		);
		results.length = 0;
		Array.prototype.push.apply(results, items);
		state.filled = true;
	}
}

for (let method of DEFERRED_METHODS) {
	QueryResults.prototype[method] = function (...args) {
		let state = resultsState.get(this);
		if (state.filled) {
			return Array.prototype[method].apply(this, args);
		}
		return state.derive([method, args]);
	};
}

for (let method of DEFERRED_IN_PLACE_METHODS) {
	QueryResults.prototype[method] = function (...args) {
		let state = resultsState.get(this);
		if (state.filled) {
			return Array.prototype[method].apply(this, args);
		}
		state.ops.push([method, args]);
		return this;
	};
}

export class TemplateQueryRegistry {
	static FLAGS = {
		QUERY: "COLLECTIONS_QUERY",
	};

	// inputPath => queries from that template’s front matter
	#queries = new Map();
	// Matches per build, shared by every template running the same query
	#matches = new Map();
	#templateMap;

	setTemplateMap(templateMap) {
		this.#templateMap = templateMap;
		this.#matches = new Map();
	}

	// Leading `/` is the input directory, everything else is relative to the calling file
	static resolvePath(fromInputPath, target, directories) {
		if (typeof target !== "string" || !target) {
			throw new Error(`Expected a string path, received: ${JSON.stringify(target)}`);
		}
		if (target.startsWith("/")) {
			return directories.getInputPath(target.slice(1));
		}
		let dir = TemplatePath.getDirFromFilePath(fromInputPath);
		return TemplatePath.addLeadingDotSlash(TemplatePath.join(dir, target));
	}

	#createResults(query, ops = []) {
		let results = new QueryResults();
		resultsState.set(results, {
			ops,
			filled: false,
			derive: (op) => this.#createResults(query, [...ops, op]),
		});
		query.results.push(results);
		return results;
	}

	// Front matter for a file is re-evaluated as a whole, so its previous queries are replaced
	createApi(inputPath, directories) {
		let queries = [];
		this.#queries.set(inputPath, queries);

		let add = (single, target, globs) => {
			let paths = globs.map((glob) =>
				TemplateQueryRegistry.resolvePath(inputPath, glob, directories),
			);
			let query = { single, target, paths, results: [] };
			queries.push(query);
			return this.#createResults(query);
		};

		return {
			collections: {
				query: (target) => {
					let results = add(true, target, [target]);
					return createLazyProxy(
						() => results[0],
						() => results.length > 0,
					);
				},
				queryAll: (globs) => add(false, globs, Array.isArray(globs) ? globs : [globs]),
			},
		};
	}

	#getMatches(query) {
		let key = `${query.single}:${query.paths.join("::")}`;
		if (!this.#matches.has(key)) {
			let matches;
			if (query.single) {
				let mapEntry = this.#templateMap?.getMapEntryForInputPath(query.paths[0]);
				matches = mapEntry ? [mapEntry] : [];
			} else {
				let map = this.#templateMap?.getMap() || [];
				matches = map.filter((mapEntry) => isGlobMatch(mapEntry.inputPath, query.paths));
			}
			this.#matches.set(key, matches);
		}
		return this.#matches.get(key);
	}

	// The template uses each template it matches, so they generate pages first
	addToGraph(inputPath, usesGraph) {
		let from = usesGraph.normalizeNode(inputPath);
		for (let query of this.#queries.get(inputPath) || []) {
			let matches = this.#getMatches(query);
			if (query.single && matches.length === 0) {
				throw new Error(
					`\`collections.query(${JSON.stringify(query.target)})\` in ${inputPath} did not match a template.`,
				);
			}
			for (let mapEntry of matches) {
				if (mapEntry.inputPath !== inputPath) {
					usesGraph.map.uses(from, usesGraph.normalizeNode(mapEntry.inputPath));
				}
			}
		}
	}

	// Matches in a cycle with this template (or itself) don’t have pages yet, `populateAll` adds them later
	populate(inputPath) {
		for (let query of this.#queries.get(inputPath) || []) {
			let pages = this.#getMatches(query).flatMap((mapEntry) => mapEntry._pages || []);
			for (let results of query.results) {
				QueryResults.fill(results, pages);
			}
		}
	}

	populateAll() {
		for (let mapEntry of this.#templateMap?.getMap() || []) {
			this.populate(mapEntry.inputPath);
		}
	}
}
