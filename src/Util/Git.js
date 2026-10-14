import { spawnAsync } from "./spawn.js";
import memoize from "./MemoizeFunction.js";

const getCreatedTimestamp = memoize(async function (filePath) {
	try {
		let timestamp = await spawnAsync(
			"git",
			// Formats https://www.git-scm.com/docs/git-log#_pretty_formats
			// %at author date, UNIX timestamp
			["log", "--diff-filter=A", "--follow", "-1", "--format=%at", filePath],
		);
		// parseInt removes trailing \n
		return parseInt(timestamp, 10) * 1000;
	} catch (e) {
		// do nothing
	}
});

const getUpdatedTimestamp = memoize(async function (filePath) {
	try {
		let timestamp = await spawnAsync(
			"git",
			// Formats https://www.git-scm.com/docs/git-log#_pretty_formats
			// %at author date, UNIX timestamp
			["log", "-1", "--format=%at", filePath],
		);
		return parseInt(timestamp, 10) * 1000;
	} catch (e) {
		// do nothing
	}
});

export { getCreatedTimestamp, getUpdatedTimestamp };
