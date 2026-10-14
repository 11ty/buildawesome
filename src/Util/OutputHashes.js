import { hash } from "node:crypto";

// Tracks a content hash per output path to detect which outputs changed between watch builds.
export class OutputHashes {
	#hashes = new Map();

	static getHash(content) {
		return hash("sha1", content);
	}

	get size() {
		return this.#hashes.size;
	}

	has(outputPath) {
		return this.#hashes.has(outputPath);
	}

	// Returns true if the content differs from the previous build (or is new) and stores the new hash.
	update(outputPath, content) {
		let contentHash = OutputHashes.getHash(content);
		let changed = this.#hashes.get(outputPath) !== contentHash;
		this.#hashes.set(outputPath, contentHash);
		return changed;
	}

	reset() {
		this.#hashes = new Map();
	}
}
