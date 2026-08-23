class CoreReservedDataError extends TypeError {}

class ReservedData {
	static fullProperties = [
		"pkg", // Object.freeze’d upstream
		"buildawesome", // Object.freeze’d upstream
		"eleventy", // Object.freeze’d upstream
		// "page" is only frozen for specific subproperties below
		"content",
		"collections",
	];

	static properties = [
		// "page" is only frozen for specific subproperties below
		"content",
		"collections",
	];

	static pageProperties = [
		"date",
		"inputPath",
		"fileSlug",
		"filePathStem",
		"outputFileExtension",
		"templateSyntax",
		"url",
		"outputPath",
		// not yet `excerpt` or `lang` set via front matter and computed data
	];

	// Check in the data cascade for reserved data properties.
	static getReservedKeys(data, globalProperties = this.fullProperties) {
		if (!data) {
			return [];
		}

		let keys = globalProperties.filter((key) => {
			return key in data;
		});

		if ("page" in data) {
			if (typeof data.page === "object") {
				for (let key of this.pageProperties) {
					if (key in data.page) {
						keys.push(`page.${key}`);
					}
				}
			} else {
				// fail `page` when set to non-object values.
				keys.push("page");
			}
		}
		return keys;
	}

	static #check(data, sourceLocation, propertiesList) {
		let reservedNames = ReservedData.getReservedKeys(data, propertiesList);
		if (reservedNames.length === 0) {
			return;
		}
		throw this.getError({
			reservedNames,
			sourceLocation,
		});
	}

	// check for frozen objects too
	static check(data, sourceLocation) {
		this.#check(data, sourceLocation, this.fullProperties);
	}

	static checkSubset(data, sourceLocation) {
		this.#check(data, sourceLocation, this.properties);
	}

	static getError(options = {}) {
		let { reservedNames, cause, sourceLocation } = options || {};

		if (cause) {
			reservedNames ??= cause.reservedNames;
		}

		let e = new CoreReservedDataError(
			`You attempted to set one of Build Awesome’s reserved data property names${reservedNames ? `: ${reservedNames.join(", ")}` : ""}${sourceLocation ? ` (source: ${sourceLocation})` : ""}. You can opt-out of this behavior with \`$config.setFreezeReservedData(false)\` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. \`buildawesome\`, \`eleventy\`, \`pkg\`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/`,
			{ cause },
		);

		if (reservedNames) {
			e.reservedNames = reservedNames;
		}
		return e;
	}

	static isFrozenError(e) {
		return (
			e instanceof TypeError &&
			e.message.startsWith("Cannot add property") &&
			e.message.endsWith("not extensible")
		);
	}

	static isReservedDataError(e) {
		return e instanceof CoreReservedDataError;
	}
}

export default ReservedData;
