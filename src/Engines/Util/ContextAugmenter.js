const DATA_KEYS = ["page", "eleventy"];

export { DATA_KEYS as augmentKeys };

export function augmentFunction(fn, options = {}) {
	let t = typeof fn;
	if (t !== "function") {
		throw new Error(
			"Invalid type passed to `augmentFunction`. A function was expected and received: " + t,
		);
	}

	/** @this {object} */
	return function (...args) {
		let context = augmentObject(this || {}, options);

		return fn.call(context, ...args);
	};
}

export function augmentObject(targetObject, options = {}) {
	options = Object.assign(
		{
			source: undefined, // where to copy from
			overwrite: true,
			lazy: false, // lazily fetch the property
			// getter: function() {},
		},
		options,
	);

	for (let key of DATA_KEYS) {
		// Skip if overwrite: false and prop already exists on target
		if (!options.overwrite && targetObject[key]) {
			continue;
		}

		if (options.lazy) {
			let value;
			if (typeof options.getter == "function") {
				value = () => options.getter(key, options.source);
			} else {
				value = () => options.source?.[key];
			}

			// lazy getter important for Liquid strictVariables support
			Object.defineProperty(targetObject, key, {
				writable: true,
				configurable: true,
				enumerable: true,
				value,
			});
		} else {
			let value;
			if (typeof options.getter == "function") {
				value = options.getter(key, options.source);
			} else {
				value = options.source?.[key];
			}

			if (value) {
				targetObject[key] = value;
			}
		}
	}

	return targetObject;
}
