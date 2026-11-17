import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { TemplatePath } from "@11ty/eleventy-utils";

// Checks each path segment against cached directory listings so results match on every OS
class ExistsCache {
	#exists = new Map();
	#dirs = new Map();
	#listings = new Map();

	constructor() {
		this.lookupCount = 0;
	}

	reset() {
		this.#exists = new Map();
		this.#dirs = new Map();
		this.#listings = new Map();
	}

	get size() {
		return this.#exists.size;
	}

	has(path) {
		return this.#exists.has(path);
	}

	set(filePath, isExist) {
		this.#exists.set(TemplatePath.addLeadingDotSlash(filePath), Boolean(isExist));
		this.#deleteListings(filePath);
	}

	// Looked up again next time, e.g. a file added or deleted while watching
	delete(filePath) {
		for (let key of [filePath, TemplatePath.addLeadingDotSlash(filePath)]) {
			this.#exists.delete(key);
			this.#dirs.delete(key);
		}
		this.#deleteListings(filePath);
	}

	// Ancestors too, since a new folder changes its parent’s listing
	#deleteListings(filePath) {
		let dir = ExistsCache.#normalizeDir(path.dirname(filePath));
		for (;;) {
			this.#listings.delete(dir);
			let parent = ExistsCache.#normalizeDir(path.dirname(dir));
			if (parent === dir) {
				break;
			}
			dir = parent;
		}
	}

	static #normalizeDir(dir) {
		if (path.isAbsolute(dir)) {
			dir = path.relative(process.cwd(), dir) || ".";
		}
		return TemplatePath.standardizeFilePath(dir).replace(/\/$/, "") || ".";
	}

	// Seeded by directory walks that already happened (e.g. tinyglobby via FileSystemSearch)
	addListing(dir, entries) {
		let listing = { names: new Set(entries), lowercase: new Map() };
		for (let entry of entries) {
			let key = entry.toLowerCase();
			listing.lowercase.set(key, [...(listing.lowercase.get(key) ?? []), entry]);
		}
		this.#listings.set(ExistsCache.#normalizeDir(dir), listing);
	}

	// `undefined` when the directory can’t be listed (missing or not a directory)
	#getListing(dir) {
		let key = ExistsCache.#normalizeDir(dir);
		if (!this.#listings.has(key)) {
			this.lookupCount++;
			try {
				this.addListing(key, readdirSync(key));
			} catch {
				this.#listings.set(key, undefined);
			}
		}

		return this.#listings.get(key);
	}

	// Returns `filePath` with on-disk casing, or `undefined` when a segment is missing
	#walk(filePath, { caseSensitive }) {
		let { root } = path.parse(filePath);
		// Odd indexes hold the separators
		let parts = filePath.slice(root.length).split(/([\\/])/);
		let dir = root || ".";
		for (let j = 0; j < parts.length; j += 2) {
			let name = parts[j];
			if (name === "" || name === ".") {
				continue;
			}
			if (name !== "..") {
				let listing = this.#getListing(dir);
				if (!listing) {
					return;
				}
				let matches = listing.lowercase.get(name.toLowerCase());
				if (!caseSensitive && matches?.length > 1) {
					throw new Error(
						`File names that differ only by case can’t be used, because case-insensitive file systems (macOS, Windows) keep only one: ${matches.map((entry) => JSON.stringify(TemplatePath.join(dir, entry))).join(" and ")}`,
					);
				}
				if (!listing.names.has(name)) {
					if (caseSensitive || !matches) {
						return;
					}
					name = parts[j] = matches[0];
				}
			}
			dir = path.join(dir, name);
		}

		return root + parts.join("");
	}

	// Exact casing on every OS
	exists(filePath) {
		if (!this.#exists.has(filePath)) {
			let exists = Boolean(filePath) && this.#walk(filePath, { caseSensitive: true }) !== undefined;

			// mark for next time
			this.#exists.set(filePath, exists);

			return exists;
		}

		return this.#exists.get(filePath);
	}

	// Returns the path with on-disk casing; throws when names differ only by case
	resolve(filePath) {
		if (filePath) {
			return this.#walk(filePath, { caseSensitive: false });
		}
	}

	isDirectory(path) {
		if (!this.exists(path)) {
			return false;
		}

		if (!this.#dirs.has(path)) {
			let isDir = statSync(path).isDirectory();
			this.lookupCount++;

			// mark for next time
			this.#dirs.set(path, isDir);

			return isDir;
		}

		return this.#dirs.get(path);
	}
}

export default ExistsCache;
