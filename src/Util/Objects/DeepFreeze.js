import { isPlainObject } from "@11ty/eleventy-utils";

// via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze

function DeepFreeze(obj, topLevelExceptions) {
	for (let name of Reflect.ownKeys(obj)) {
		if ((topLevelExceptions || []).find((key) => key === name)) {
			continue;
		}

		const value = obj[name];
		if (isPlainObject(value)) {
			DeepFreeze(value);
		}
	}

	return Object.freeze(obj);
}

export { DeepFreeze };
