const DATA_KEYS = ["page", "eleventy", "buildawesome", "collections"];
const DATA_METHOD = "getData";

// Keys set by this module, so `overwrite: false` only preserves user-defined properties on reused objects.
const augmented = new WeakMap();

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
			// dataGetter: function(source) {}, // defaults to `source`
		},
		options,
	);

	// e.g. 11ty.js functions called on the instance they were augmented from
	if (targetObject === options.source) {
		return targetObject;
	}

	for (let key of DATA_KEYS) {
		// Skip if overwrite: false and prop already exists on target
		if (!options.overwrite && isUserDefined(targetObject, key)) {
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
			defineGetter(targetObject, key, value);
		} else {
			let value;
			if (typeof options.getter == "function") {
				value = options.getter(key, options.source);
			} else {
				value = options.source?.[key];
			}

			if (value) {
				targetObject[key] = value;
				markAugmented(targetObject, key);
			}
		}
	}

	// Full data cascade, a method since some engines build a new object on access.
	if (options.overwrite || !isUserDefined(targetObject, DATA_METHOD)) {
		let dataGetter = options.dataGetter ?? ((source) => source);
		targetObject[DATA_METHOD] = () => dataGetter(options.source);
		markAugmented(targetObject, DATA_METHOD);
	}

	return targetObject;
}

function isUserDefined(targetObject, key) {
	return Boolean(targetObject[key]) && !augmented.get(targetObject)?.has(key);
}

function markAugmented(targetObject, key) {
	if (!augmented.has(targetObject)) {
		augmented.set(targetObject, new Set());
	}
	augmented.get(targetObject).add(key);
}

function defineGetter(targetObject, key, get) {
	markAugmented(targetObject, key);
	Object.defineProperty(targetObject, key, {
		configurable: true,
		enumerable: true,
		get,
		set(value) {
			Object.defineProperty(this, key, {
				value,
				writable: true,
				configurable: true,
				enumerable: true,
			});
		},
	});
}
