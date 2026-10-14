import lodash from "@11ty/lodash-custom";
import { isPlainObject } from "@11ty/eleventy-utils";

const { set: lodashSet, get: lodashGet } = lodash;

const UNDEFINED_VALUE = Symbol("undefined");

/* Finds computed data used by JavaScript functions using Proxies */
class ComputedDataProxy {
	constructor(computedKeys) {
		this.computedKeys = new Set(computedKeys);
	}

	isArrayOrPlainObject(data) {
		return Array.isArray(data) || isPlainObject(data);
	}

	getProxyData(data, keyRef) {
		// WARNING: side effect, sets defaults on `data` for computed keys not yet set
		// TODO should make another effort to get rid of this, see the ProxyWrap util
		for (let key of this.computedKeys) {
			if (lodashGet(data, key, UNDEFINED_VALUE) === UNDEFINED_VALUE) {
				lodashSet(data, key, "");
			}
		}

		return this.#getProxyData(data, keyRef);
	}

	// Track leaf access and recurse into objects/arrays
	#getChildProxy(childData, keyRef, key) {
		let proxy = this.#getProxyData(childData, keyRef, key);
		if (!this.isArrayOrPlainObject(proxy)) {
			keyRef.add(key);
		}
		return proxy;
	}

	#getProxyForObject(dataObj, keyRef, parentKey) {
		return new Proxy(
			{},
			{
				get: (obj, key) => {
					if (typeof key !== "string") {
						return obj[key];
					}

					let newKey = parentKey ? `${parentKey}.${key}` : key;

					// Issue #1137: always return an Array for collections so Array methods work
					if (newKey === "collections") {
						keyRef.add(newKey);
						return new Proxy(
							{},
							{
								get: (target, collectionName) => {
									if (typeof collectionName !== "string") {
										return target[collectionName];
									}
									keyRef.add(`collections.${collectionName}`);
									return [];
								},
							},
						);
					}

					return this.#getChildProxy(dataObj[key], keyRef, newKey);
				},
			},
		);
	}

	#getProxyForArray(dataArr, keyRef, parentKey) {
		return new Proxy(new Array(dataArr.length), {
			get: (obj, key) => {
				// Array methods (`filter`, `map`, etc.) mean the whole Array is used
				if (Array.prototype.hasOwnProperty(key)) {
					keyRef.add(parentKey);
					return obj[key];
				}

				// Hm, this needs to be better
				if (key === "then") {
					keyRef.add(parentKey);
					return;
				}

				return this.#getChildProxy(dataArr[key], keyRef, `${parentKey}[${key}]`);
			},
		});
	}

	#getProxyData(data, keyRef, parentKey = "") {
		if (isPlainObject(data)) {
			return this.#getProxyForObject(data, keyRef, parentKey);
		}
		if (Array.isArray(data)) {
			return this.#getProxyForArray(data, keyRef, parentKey);
		}
		return data;
	}

	async findVarsUsed(fn, data = {}) {
		let keyRef = new Set();

		// careful, logging proxyData will mess with test results!
		await fn(this.getProxyData(data, keyRef));

		return Array.from(keyRef);
	}
}

export default ComputedDataProxy;
