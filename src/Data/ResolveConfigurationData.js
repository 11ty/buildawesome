import lodash from "@11ty/lodash-custom";
import { isPlainObject, DeepCopy } from "@11ty/eleventy-utils";

const { get: lodashGet } = lodash;

// buildawesomeDataSchema looks for buildawesomeDataSchema and eleventyDataSchema (this is what we use internally)
// eleventyDataSchema looks for eleventyDataSchema (and not buildawesomeDataSchema)
export class ResolveConfigurationData {
	static EXCLUDE_FROM_COLLECTIONS_KEY = "buildawesomeExcludeFromCollections";

	static ELIGIBLE_PROPS = new Set([
		// If these props are overridden by a user’s configuration, they will not be aliased (which is ok)
		"buildawesomeComputed",
		"buildawesomeDataSchema",
		this.EXCLUDE_FROM_COLLECTIONS_KEY,
		"buildawesomeImport",
	]);
	static BUILDAWESOME_PREFIX = "buildawesome";
	static ELEVENTY_PREFIX = "eleventy";

	// buildawesomeDataSchema becomes eleventyDataSchema
	// eleventyDataSchema returned undefined
	static getAlternatePropertyName(propertyName) {
		if (typeof propertyName === "string" && this.ELIGIBLE_PROPS.has(propertyName)) {
			let prefixRemoved = propertyName.slice(ResolveConfigurationData.BUILDAWESOME_PREFIX.length);
			return this.ELEVENTY_PREFIX + prefixRemoved;
		}
	}

	static getEligibleLocations(original) {
		let eligibleLocations = [original];
		let alternate = this.getAlternatePropertyName(original);
		if (alternate !== undefined && alternate !== original) {
			eligibleLocations.push(alternate);
		}
		return eligibleLocations;
	}

	// Folds `eleventy*` aliases into `buildawesome*` per cascade layer so the cascade orders a single key, #4311
	static normalize(data) {
		if (!isPlainObject(data)) {
			return data;
		}

		let normalized;
		for (let prop of this.ELIGIBLE_PROPS) {
			let alternate = this.getAlternatePropertyName(prop);
			if (!Object.hasOwn(data, alternate)) {
				continue;
			}

			normalized ??= Object.assign({}, data);
			normalized[prop] = this.getValue(data, prop);
			delete normalized[alternate];
		}

		return normalized ?? data;
	}

	static getValue(data, location) {
		let values = [];
		for (let loc of this.getEligibleLocations(location)) {
			let val = lodashGet(data, loc, undefined);
			if (val !== undefined) {
				values.push(val);
			}
		}

		// Skip the merge copy in the common single-location case
		if (values.length < 2) {
			return values[0];
		}

		let merging;
		for (let val of values) {
			if (isPlainObject(val)) {
				merging = DeepCopy(merging || {}, val);
			} else if (Array.isArray(val)) {
				merging = DeepCopy(merging || [], val);
			} else if (merging === undefined) {
				return val;
			}
		}

		return merging;
	}
}
