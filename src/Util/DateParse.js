import { IsoDate } from "@11ty/parse-date-strings";

import { createDebug } from "./DebugLogUtil.js";

const debug = createDebug("DateTime");

export function fromISOtoDateUTC(dateValue, inputPath) {
	// This has had a UTC default since the beginnning:
	// https://github.com/11ty/eleventy/commit/4272311dab203d2b217ebd4f6b597eb0e816006b
	try {
		let date = IsoDate.parse(dateValue);
		debug("@11ty/parse-date-strings parsed %o as %o", dateValue, date);

		return date;
	} catch (e) {
		throw new Error(
			`Data cascade value for \`date\` (${dateValue}) is invalid${inputPath ? ` for ${inputPath}` : ""}`,
			{ cause: e },
		);
	}
}
