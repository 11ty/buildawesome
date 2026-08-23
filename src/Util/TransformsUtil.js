import { isPlainObject } from "@11ty/eleventy-utils";

import BaseError from "../Errors/BaseError.js";
import { createDebug } from "./DebugLogUtil.js";

const debug = createDebug("Transforms");

class TransformError extends BaseError {}

class TransformsUtil {
	static changeTransformsToArray(transformsObj) {
		let transforms = [];
		for (let name in transformsObj) {
			transforms.push({
				name: name,
				callback: transformsObj[name],
			});
		}
		return transforms;
	}

	static async runAll(content, pageData, transforms = {}, options = {}) {
		let { baseHrefOverride, logger } = options;
		let { inputPath, outputPath, url } = pageData;

		if (!isPlainObject(transforms)) {
			throw new Error("Object of transforms expected.");
		}

		let transformsArray = this.changeTransformsToArray(transforms);

		for (let { callback, name } of transformsArray) {
			debug("Running %o transform on %o: %o", name, inputPath, outputPath);

			try {
				let hadContentBefore = !!content;

				content = await callback.call(
					{
						inputPath,
						outputPath,
						url,
						page: pageData,
						baseHref: baseHrefOverride,
					},
					content,
					outputPath,
				);

				if (hadContentBefore && !content) {
					if (!logger || !logger.warn) {
						throw new Error("Internal error: missing `logger` instance.");
					}

					logger.warn(
						`Warning: Transform \`${name}\` returned empty when writing ${outputPath} from ${inputPath}.`,
					);
				}
			} catch (e) {
				throw new TransformError(
					`Transform \`${name}\` encountered an error when transforming ${inputPath}.`,
					e,
				);
			}
		}

		return content;
	}
}

export default TransformsUtil;
