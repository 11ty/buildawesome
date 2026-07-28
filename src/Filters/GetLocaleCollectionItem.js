import getCollectionItem from "./GetCollectionItem.js";

// Work with I18n Plugin src/Plugins/I18nPlugin.js to retrieve root pages (not i18n pages)
function resolveRootPage(config, pageOverride, languageCode) {
	let localeFilter = config.getFilter("locale_page");
	if (!localeFilter || typeof localeFilter !== "function") {
		return pageOverride;
	}

	// returns root/default-language `page` object
	return localeFilter.call(this, pageOverride, languageCode);
}

function getLocaleCollectionItem(config, collection, pageOverride, langCode, indexModifier = 0) {
	if (!langCode) {
		// if page.lang exists (2.0.0-canary.14 and i18n plugin added, use page language)
		if (this.page.lang) {
			langCode = this.page.lang;
		} else {
			return getCollectionItem(collection, pageOverride || this.page, indexModifier);
		}
	}

	let rootPage = resolveRootPage.call(this, config, pageOverride); // implied current page, default language
	let modifiedRootItem = getCollectionItem(collection, rootPage, indexModifier);
	if (!modifiedRootItem) {
		return; // no root item exists for the previous/next page
	}

	// Resolve modified root `page` back to locale `page`
	// This will return a non localized version of the page as a fallback
	let modifiedLocalePage = resolveRootPage.call(this, config, modifiedRootItem.data.page, langCode);
	// already localized (or default language)
	if (!("__locale_page_resolved" in modifiedLocalePage)) {
		return modifiedRootItem;
	}

	// find the modified locale `page` again in `collections.all`
	let all = this.collections?.all || this.data?.collections?.all || [];

	return getCollectionItem(all, modifiedLocalePage, 0);
}

export default getLocaleCollectionItem;
