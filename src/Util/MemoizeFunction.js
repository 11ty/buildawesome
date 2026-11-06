export default function (callback, options = {}) {
	let { bench, name, getCacheKey } = options;
	let cache = new Map();

	let memoized = (...args) => {
		// Without `getCacheKey`, only single-arg functions are supported.
		if (!getCacheKey && args.filter(Boolean).length > 1) {
			bench?.get(`(count) ${name} Not valid for memoize`).incrementCount();
			return callback(...args);
		}

		let cacheKey = getCacheKey ? getCacheKey(...args) : args[0];

		if (!cache.has(cacheKey)) {
			let result = callback(...args);
			cache.set(cacheKey, result);

			// Failed promises are not cached so the next call retries.
			if (typeof result?.then === "function") {
				result.then(undefined, () => {
					if (cache.get(cacheKey) === result) {
						cache.delete(cacheKey);
					}
				});
			}

			bench?.get(`(count) ${name} memoize miss`).incrementCount();

			return result;
		}

		bench?.get(`(count) ${name} memoize hit`).incrementCount();

		return cache.get(cacheKey);
	};

	memoized.clear = () => cache.clear();

	return memoized;
}
