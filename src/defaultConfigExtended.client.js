export default function (config) {
	config.addFilter("url", () => {
		throw new Error(
			"The `url` filter is not included with the `@11ty/client` bundle. Use the `@11ty/client/core-fs` bundle.",
		);
	});

	config.addFilter("inputPathToUrl", () => {
		throw new Error(
			"The `inputPathToUrl` filter is not included with the `@11ty/client` bundle. Use the larger `@11ty/client/core-fs` bundle.",
		);
	});

	// Saves ~26KB (minified)
	// Differences from main bundle: async and not memoized
	config.addAsyncFilter("slugify", async function (str, options = {}) {
		return import("@sindresorhus/slugify")
			.then((mod) => mod.default)
			.then((slugify) => {
				options.decamelize ??= false;
				return slugify("" + str, options);
			});
	});
}
