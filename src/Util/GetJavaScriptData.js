import BaseError from "../Errors/BaseError.js";

class JavaScriptInvalidDataFormatError extends BaseError {}

export default async function (inst, inputPath, key = "data", options = {}) {
	let { mixins, isObjectRequired } = Object.assign(
		{
			mixins: {},
			isObjectRequired: true,
		},
		options,
	);

	if (inst && key in inst) {
		// get extra data from `data` method,
		// either as a function or getter or object literal
		let result = await (typeof inst[key] === "function"
			? Object.keys(mixins).length > 0
				? inst[key].call(mixins)
				: inst[key]()
			: inst[key]);

		if (isObjectRequired && typeof result !== "object") {
			throw new JavaScriptInvalidDataFormatError(
				`Invalid data format returned from ${inputPath}: typeof ${typeof result}`,
			);
		}
		return result;
	}
}
