// Memoized per collection array, which Eleventy recreates on each build.
const rootCollections = new WeakMap();

// Work with I18n Plugin src/Plugins/I18nPlugin.js to retrieve root pages (not i18n pages)
export function resolveRootPage(config, pageOverride, languageCode) {
	let localeFilter = config.getFilter("locale_page");
	if (!localeFilter || typeof localeFilter !== "function") {
		return pageOverride;
	}

	// returns root/default-language `page` object
	return localeFilter.call(this, pageOverride, languageCode);
}

// Index arithmetic assumes default-language pages only, so a collection holding every
// language (e.g. from `tags`) would otherwise resolve to translations of the same page.
export function getRootCollection(config, collection) {
	if (rootCollections.has(collection)) {
		return rootCollections.get(collection);
	}

	let filtered = [];
	for (let item of collection) {
		let page = item?.data?.page;
		if (!page || resolveRootPage.call(this, config, page).url === page.url) {
			filtered.push(item);
		}
	}

	rootCollections.set(collection, filtered);
	return filtered;
}
