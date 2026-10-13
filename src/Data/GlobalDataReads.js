import { isPlainObject } from "@11ty/eleventy-utils";

// Records which global data keys a template reads, so a global data file change
// only re-renders the templates that read it (incremental builds).

const TrackedSymbol = Symbol.for("11ty.GlobalDataReads");

let paused = 0;

// e.g. a deep copy that reads every key but isn’t a real use of the data
export function withoutTracking(callback) {
	paused++;
	try {
		return callback();
	} finally {
		paused--;
	}
}

function isTracked(value) {
	return Boolean(value?.[TrackedSymbol]);
}

/**
 * Wraps the top-level global data values of a template’s data in place.
 * @param {object} data
 * @param {Map<string, string[]>} filesByKey global data files for each top-level key
 * @param {(files: string[]) => void} onRead called once per key, on first read
 */
export function trackGlobalDataReads(data, filesByKey, onRead) {
	for (let [key, files] of filesByKey) {
		if (!Object.hasOwn(data, key)) {
			continue;
		}

		let value = data[key];
		if (isTracked(value)) {
			continue;
		}

		// Proxies only work for plain objects and arrays: other values (strings, dates, class instances) count as read
		if (!isPlainObject(value) && !Array.isArray(value)) {
			onRead(files);
			continue;
		}

		let isRead = false;
		let record = () => {
			if (!isRead && !paused) {
				isRead = true;
				onRead(files);
			}
		};

		data[key] = new Proxy(value, {
			get(target, prop) {
				if (prop === TrackedSymbol) {
					return true;
				}
				record();
				return Reflect.get(target, prop);
			},
			has(target, prop) {
				record();
				return Reflect.has(target, prop);
			},
			ownKeys(target) {
				record();
				return Reflect.ownKeys(target);
			},
			getOwnPropertyDescriptor(target, prop) {
				record();
				return Reflect.getOwnPropertyDescriptor(target, prop);
			},
		});
	}
}
