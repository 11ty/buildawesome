export function findCollectionItemIndex(collection, page) {
	let j = 0;
	for (let item of collection) {
		if (
			item.inputPath === page.inputPath &&
			(item.outputPath === page.outputPath || item.url === page.url)
		) {
			return j;
		}
		j++;
	}
}

export default function getCollectionItem(collection, page, modifier = 0) {
	let index = findCollectionItemIndex(collection, page);

	if (index !== undefined && collection?.length) {
		if (index + modifier >= 0 && index + modifier < collection.length) {
			return collection[index + modifier];
		}
	}
}
