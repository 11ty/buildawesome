let depth = 0;

// Synchronous reads by Eleventy itself (e.g. a deep copy) that aren’t a real use of the data: not tracked, no early read warnings
export function withoutTracking(callback) {
	depth++;
	try {
		return callback();
	} finally {
		depth--;
	}
}

export function isInternalRead() {
	return depth > 0;
}
