import lodash from "@11ty/lodash-custom";
import { isPlainObject, DeepCopy } from "@11ty/eleventy-utils";

const { get: lodashGet } = lodash;

// buildawesomeDataSchema looks for buildawesomeDataSchema and eleventyDataSchema (this is what we use internally)
// eleventyDataSchema looks for eleventyDataSchema (and not buildawesomeDataSchema)
export class ResolveConfigurationData {
	static ELIGIBLE_PROPS = new Set([
		// If these props are overridden by a user’s configuration, they will not be aliased (which is ok)
		"buildawesomeComputed",
		"buildawesomeDataSchema",
		"buildawesomeExcludeFromCollections",
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

	static getValue(data, location) {
		let eligible = this.getEligibleLocations(location);
		let merging;

		for (let loc of eligible) {
			let val = lodashGet(data, loc, undefined);
			if (val === undefined) {
				continue;
			}

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
