import { isPlainObject } from "@11ty/eleventy-utils";
// import { createDebug } from "../DebugLogUtil.js";

// const debug = createDebug("Dev:Eleventy:Proxy");

const ProxySymbol = Symbol.for("11ty.ProxySymbol");

function wrapObject(target, fallback) {
	if (Object.isFrozen(target)) {
		return target;
	}

	return new Proxy(target, {
		getOwnPropertyDescriptor(target, prop) {
			let ret;

			if (Reflect.has(target, prop)) {
				ret = Reflect.getOwnPropertyDescriptor(target, prop);
			} else if (Reflect.has(fallback, prop)) {
				ret = Reflect.getOwnPropertyDescriptor(fallback, prop);
			}

			return ret;
		},
		has(target, prop) {
			if (Reflect.has(target, prop)) {
				return true;
			}

			return Reflect.has(fallback, prop);
		},
		ownKeys(target) {
			let s = new Set();
			// The fallback keys need to come first to preserve proper key order
			// https://github.com/11ty/eleventy/issues/3849
			if (isPlainObject(fallback)) {
				for (let k of Reflect.ownKeys(fallback)) {
					s.add(k);
				}
			}
			for (let k of Reflect.ownKeys(target)) {
				if (!s.has(k)) {
					s.add(k);
				}
			}
			return Array.from(s);
		},
		get(target, prop) {
			// debug("handler:get", prop);
			if (prop === ProxySymbol) {
				return true;
			}

			let value = Reflect.get(target, prop);

			if (Reflect.has(target, prop)) {
				// Careful: swapped from node:util/types->isProxy test here
				if (Reflect.get(target, ProxySymbol)) {
					return value;
				}

				if (isPlainObject(value) && Reflect.has(fallback, prop)) {
					if (Object.isFrozen(value)) {
						return value;
					}

					let ret = wrapObject(value, Reflect.get(fallback, prop));
					// debug("handler:get (primary, object)", prop);
					return ret;
				}

				// debug("handler:get (primary)", prop);
				return value;
			}

			// Does not exist in primary
			if (
				(typeof fallback === "object" || typeof fallback === "function") &&
				Reflect.has(fallback, prop)
			) {
				// fallback has prop
				let fallbackValue = Reflect.get(fallback, prop);

				if (isPlainObject(fallbackValue)) {
					if (Object.isFrozen(fallbackValue)) {
						return fallbackValue;
					}

					// debug("handler:get (fallback, object)", prop);
					// set empty object on primary
					let emptyObject = {};
					Reflect.set(target, prop, emptyObject);

					return wrapObject(emptyObject, fallbackValue);
				}

				// debug("handler:get (fallback)", prop);
				return fallbackValue;
			}

			// primary *and* fallback do _not_ have prop
			// debug("handler:get (not on primary or fallback)", prop);

			return value;
		},
		set(target, prop, value) {
			// debug("handler:set", prop);

			return Reflect.set(target, prop, value);
		},
	});
}

function ProxyWrap(target, fallback) {
	if (!isPlainObject(target) || !isPlainObject(fallback)) {
		throw new Error("ProxyWrap expects objects for both the target and fallback");
	}

	return wrapObject(target, fallback);
}

export { ProxyWrap };
