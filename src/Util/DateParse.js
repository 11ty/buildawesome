import { IsoDate, IsoDateParts } from "@11ty/parse-date-strings";

import { createDebug } from "./DebugLogUtil.js";

const debug = createDebug("DateTime");

// Converts wall-clock parts (1-indexed month) in an IANA time zone to a Date.
function temporalAdapter(parts, zone) {
	return new Date(Temporal.PlainDateTime.from(parts).toZonedDateTime(zone).epochMilliseconds);
}

function getWallTimeParts(date) {
	return {
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
		hour: date.getUTCHours(),
		minute: date.getUTCMinutes(),
		second: date.getUTCSeconds(),
		millisecond: date.getUTCMilliseconds(),
	};
}

function isValidDate(date) {
	return date instanceof Date && !Number.isNaN(date.getTime());
}

export function getTimeZoneParser(zone, options = {}) {
	let adapter = options.adapter;
	if (adapter === undefined) {
		if (typeof globalThis.Temporal === "undefined") {
			throw new Error(
				"setDateTimeZone requires a JavaScript runtime with Temporal support (e.g. Node.js 26+), or an `adapter` function option.",
			);
		}
		adapter = temporalAdapter;
	} else if (typeof adapter !== "function") {
		throw new Error("setDateTimeZone expects the `adapter` option to be a function.");
	}

	// Probe the adapter once so an invalid zone fails at configuration time.
	let probe;
	try {
		probe =
			typeof zone === "string" && zone ? adapter(getWallTimeParts(new Date(0)), zone) : undefined;
	} catch (e) {
		throw new Error(`Invalid time zone passed to setDateTimeZone: ${zone}`, { cause: e });
	}
	if (!isValidDate(probe)) {
		throw new Error(`Invalid time zone passed to setDateTimeZone: ${zone}`);
	}

	return {
		zone,
		toDate(wallDate) {
			let date = adapter(getWallTimeParts(wallDate), zone);
			if (!isValidDate(date)) {
				throw new Error(`setDateTimeZone adapter returned an invalid Date for time zone ${zone}`);
			}
			return date;
		},
	};
}

function hasOffset(dateValue) {
	return !!dateValue.match(IsoDateParts.DATETIME_REGEX)?.[8];
}

export function fromISOtoDateUTC(dateValue, inputPath, timeZone) {
	// This has had a UTC default since the beginnning:
	// https://github.com/11ty/eleventy/commit/4272311dab203d2b217ebd4f6b597eb0e816006b
	try {
		let date = IsoDate.parse(dateValue);
		debug("@11ty/parse-date-strings parsed %o as %o", dateValue, date);

		if (timeZone && !hasOffset(dateValue)) {
			date = timeZone.toDate(date);
			debug("Reinterpreted %o in time zone %o as %o", dateValue, timeZone.zone, date);
		}

		return date;
	} catch (e) {
		throw new Error(
			`Data cascade value for \`date\` (${dateValue}) is invalid${inputPath ? ` for ${inputPath}` : ""}`,
			{ cause: e },
		);
	}
}
