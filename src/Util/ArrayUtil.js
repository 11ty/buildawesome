export function arrayDelete(arr, match) {
	if (!Array.isArray(arr)) {
		return [];
	}

	if (!match) {
		return arr;
	}

	// only mutates if found
	if (typeof match === "function") {
		if (arr.find(match)) {
			return arr.filter((entry) => {
				return !match(entry);
			});
		}
	} else if (arr.includes(match)) {
		return arr.filter((entry) => {
			return entry !== match;
		});
	}

	return arr;
}
