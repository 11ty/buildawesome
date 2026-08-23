import { TemplatePath } from "@11ty/eleventy-utils";

import PathNormalizer from "./Util/PathNormalizer.js";

/*
 * Decides when to watch and in what mode to watch
 */

class WatchQueue {
	static normalizePath(path) {
		if (!path) {
			return;
		}
		return PathNormalizer.normalizeSeperator(
			TemplatePath.addLeadingDotSlash(TemplatePath.normalize(path)),
		);
	}

	constructor() {
		this.activeQueue = [];
	}

	// on SIGINT
	reset() {
		this.pendingQueue = [];
		this.activeQueue = [];
	}

	isBuildRunning() {
		return this.activeQueue.length > 0;
	}

	startBuild() {
		if (this.isBuildRunning()) {
			throw new Error(
				"Internal error: build already running. Use finishBuild() before calling startBuild() again.",
			);
		}

		// pop waiting queue into the active queue
		this.activeQueue = this.popNextActiveQueue();
	}

	finishBuild() {
		this.activeQueue = [];
	}

	setActiveQueue(queue) {
		if (!queue || !Array.isArray(queue)) {
			return;
		}

		for (let path of queue) {
			let normalized = WatchQueue.normalizePath(path);
			if (!this.activeQueue.includes(normalized)) {
				this.activeQueue.push(normalized);
			}
		}
	}

	/*
	 * Returns the changed files currently being operated on in the current `watch` build
	 */
	getActiveQueue() {
		return this.activeQueue;
	}

	#queueMatches(file) {
		let filterCallback;
		if (typeof file === "function") {
			filterCallback = file;
		} else {
			filterCallback = (path) => path === file;
		}

		return this.activeQueue.filter(filterCallback);
	}

	hasAllQueueFiles(file) {
		return (
			this.activeQueue.length > 0 && this.activeQueue.length === this.#queueMatches(file).length
		);
	}

	hasQueuedFile(file) {
		if (file) {
			return this.#queueMatches(file).length > 0;
		}
		return false;
	}

	hasQueuedFiles(files) {
		for (const file of files) {
			if (this.hasQueuedFile(file)) {
				return true;
			}
		}
		return false;
	}

	get pendingQueue() {
		if (!this._queue) {
			this._queue = [];
		}
		return this._queue;
	}

	set pendingQueue(value) {
		this._queue = value;
	}

	addToPendingQueue(path) {
		if (!path) {
			return;
		}

		let normalized = WatchQueue.normalizePath(path);
		if (!this.pendingQueue.includes(normalized)) {
			this.pendingQueue.push(normalized);
		}
	}

	getPendingQueueSize() {
		return this.pendingQueue.length;
	}

	getPendingQueue() {
		return this.pendingQueue;
	}

	getActiveQueueSize() {
		return this.activeQueue.length;
	}

	clearPendingQueue() {
		this.pendingQueue = [];
	}

	// returns array
	popNextActiveQueue() {
		let ret = this.pendingQueue.slice();
		this.pendingQueue = [];
		return ret;
	}
}

export default WatchQueue;
