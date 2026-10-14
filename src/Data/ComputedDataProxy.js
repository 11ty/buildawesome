import lodash from "@11ty/lodash-custom";
import { isPlainObject } from "@11ty/eleventy-utils";

const { set: lodashSet, get: lodashGet } = lodash;

/* Calculates computed data using Proxies */
class ComputedDataProxy {
	constructor(computedKeys) {
		if (Array.isArray(computedKeys)) {
			this.computedKeys = new Set(computedKeys);
		} else {
			this.computedKeys = computedKeys;
		}
	}

	isArrayOrPlainObject(data) {
		return Array.isArray(data) || isPlainObject(data);
	}

	getProxyData(data, keyRef) {
		// WARNING: SIDE EFFECTS
		// Set defaults for keys not already set on parent data

		// TODO should make another effort to get rid of this,
		// See the ProxyWrap util for more proxy handlers that will likely fix this
		let undefinedValue = "__11TY_UNDEFINED__";
		if (this.computedKeys) {
			for (let key of this.computedKeys) {
				if (lodashGet(data, key, undefinedValue) === undefinedValue) {
					lodashSet(data, key, "");
				}
			}
		}

		let proxyData = this._getProxyData(data, keyRef);
		return proxyData;
	}

	_getProxyForObject(dataObj, keyRef, parentKey = "") {
		return new Proxy(
			{},
			{
				get: (obj, key) => {
					if (typeof key !== "string") {
						return obj[key];
					}

					let newKey = `${parentKey ? `${parentKey}.` : ""}${key}`;

					// Issue #1137
					// Special case for Collections, always return an Array for collection keys
					// so they it works fine with Array methods like `filter`, `map`, etc
					if (newKey === "collections") {
						keyRef.add(newKey);
						return new Proxy(
							{},
							{
								get: (target, key) => {
									if (typeof key === "string") {
										keyRef.add(`collections.${key}`);
										return [];
									}
									return target[key];
								},
							},
						);
					}

					let newData = this._getProxyData(dataObj[key], keyRef, newKey);
					if (!this.isArrayOrPlainObject(newData)) {
						keyRef.add(newKey);
					}
					return newData;
				},
			},
		);
	}

	_getProxyForArray(dataArr, keyRef, parentKey = "") {
		return new Proxy(new Array(dataArr.length), {
			get: (obj, key) => {
				if (Array.prototype.hasOwnProperty(key)) {
					// remove `filter`, `constructor`, `map`, etc
					keyRef.add(parentKey);
					return obj[key];
				}

				// Hm, this needs to be better
				if (key === "then") {
					keyRef.add(parentKey);
					return;
				}

				let newKey = `${parentKey}[${key}]`;
				let newData = this._getProxyData(dataArr[key], keyRef, newKey);
				if (!this.isArrayOrPlainObject(newData)) {
					keyRef.add(newKey);
				}
				return newData;
			},
		});
	}

	_getProxyData(data, keyRef, parentKey = "") {
		if (isPlainObject(data)) {
			return this._getProxyForObject(data, keyRef, parentKey);
		} else if (Array.isArray(data)) {
			return this._getProxyForArray(data, keyRef, parentKey);
		}

		// everything else!
		return data;
	}

	async findVarsUsed(fn, data = {}) {
		let keyRef = new Set();

		// careful, logging proxyData will mess with test results!
		let proxyData = this.getProxyData(data, keyRef);

		// squelch console logs for this fake proxy data pass 😅
		// let savedLog = console.log;
		// console.log = () => {};
		await fn(proxyData);
		// console.log = savedLog;

		return Array.from(keyRef);
	}
}

export default ComputedDataProxy;
