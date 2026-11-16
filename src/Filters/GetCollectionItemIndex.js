import { findCollectionItemIndex } from "./GetCollectionItem.js";
import { getRootCollection, resolveRootPage } from "./LocaleCollection.js";

export default function getCollectionItemIndex(config, collection, page) {
	if (!page) {
		page = this.page;
	}

	// `page.lang` only exists when the i18n plugin is added
	if (page.lang) {
		return findCollectionItemIndex(
			getRootCollection.call(this, config, collection),
			resolveRootPage.call(this, config, page),
		);
	}

	return findCollectionItemIndex(collection, page);
}
