const SETTING = "$config.configureFeatures({ collections: false })";

export function getDisabledCollectionsError(reason) {
	return new Error(`${reason} Collections are disabled via \`${SETTING}\`.`);
}

// Not a plain object, so the data cascade keeps it by reference instead of merging into it
class DisabledCollections {}

// Shared by every page as `data.collections`
export const disabledCollections = new Proxy(new DisabledCollections(), {
	get(target, prop) {
		throw getDisabledCollectionsError(`Cannot read \`collections.${String(prop)}\`.`);
	},
});
