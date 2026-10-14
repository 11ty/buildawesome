export default function (callback, options = {}) {
	let { bench, name } = options;
	let cache = new Map();

	return (...args) => {
		// Only supports single-arg functions for now.
		if (args.filter(Boolean).length > 1) {
			bench?.get(`(count) ${name} Not valid for memoize`).incrementCount();
			return callback(...args);
		}

		let [cacheKey] = args;

		if (!cache.has(cacheKey)) {
			cache.set(cacheKey, callback(...args));

			bench?.get(`(count) ${name} memoize miss`).incrementCount();

			return cache.get(cacheKey);
		}

		bench?.get(`(count) ${name} memoize hit`).incrementCount();

		return cache.get(cacheKey);
	};
}
