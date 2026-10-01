import { mkdirSync, openSync, writeSync } from "node:fs";
import path from "node:path";
import { TemplatePath } from "@11ty/eleventy-utils";

// Bump on a breaking change
const SCHEMA_VERSION = 1;

/** @param {object} result */
function toManifestEntry(result) {
	return {
		inputPath: result?.inputPath,
		outputPath: result?.outputPath,
		url: result?.url,
	};
}

/** @param {string} filePath */
function toIgnoreGlob(filePath) {
	let relative = TemplatePath.addLeadingDotSlash(
		TemplatePath.relativePath(TemplatePath.absolutePath(filePath)),
	);
	// `watchIgnores` are globs; match this path literally
	return relative.replace(/[*?[\]{}()!+@|]/g, "\\$&");
}

/** @param {Error} error */
function findFilePath(error) {
	// Template errors may be wrapped more than once
	for (let e = error; e; e = e.cause) {
		if (e.filePath) {
			return e.filePath;
		}
	}
}

/** Build events as newline-delimited JSON (--events-file) */
export class NdjsonReporter {
	/** @type {string} */
	#filePath;
	/** @type {number} */
	#fd;
	/** @type {object|undefined} */
	#eleventyConfig;
	/** @type {number|undefined} */
	#startedAt;

	constructor(filePath) {
		this.#filePath = filePath;
		// Sync so the last event lands before exit; fails fast on a bad path
		mkdirSync(path.dirname(filePath), { recursive: true });
		this.#fd = openSync(filePath, "w");
	}

	/** @param {object} event */
	#emit(event) {
		try {
			writeSync(this.#fd, `${JSON.stringify(event)}\n`);
		} catch (e) {
			// Event file failures must not fail the build
			// Forced because `warn()` goes to DEBUG under --quiet
			this.#eleventyConfig?.logger?.logWithOptions({
				message: `Could not write to --events-file: ${e.message}`,
				type: "warn",
				force: true,
			});
		}
	}

	/** @param {number} now */
	#getDuration(now) {
		// Integer ms, like `ts`
		return this.#startedAt !== undefined ? Math.round(now - this.#startedAt) : undefined;
	}

	/** @param {object} eleventyConfig */
	config(eleventyConfig) {
		// Logger can be swapped after init
		this.#eleventyConfig = eleventyConfig;
		// Writing the file must not trigger a rebuild
		eleventyConfig.watchIgnores.add(toIgnoreGlob(this.#filePath));

		let afterRegistered = false;

		eleventyConfig.on("buildawesome.before", (eventsArg) => {
			this.#startedAt = performance.now();
			this.#emit({
				v: SCHEMA_VERSION,
				type: "build.start",
				ts: Date.now(),
				runMode: eventsArg.runMode,
				incremental: Boolean(eventsArg.incremental),
			});

			// Registered last so a throwing user `after` listener skips `build.end`
			if (!afterRegistered) {
				afterRegistered = true;
				eleventyConfig.on("buildawesome.after", (eventsArg) => {
					this.#emit({
						v: SCHEMA_VERSION,
						type: "build.end",
						ts: Date.now(),
						ok: true,
						durationMs: this.#getDuration(performance.now()),
						pages: (eventsArg.results || []).map(toManifestEntry),
					});
				});
			}
		});

		// Watch mode doesn’t exit on error
		eleventyConfig.on("buildawesome.aftererror", (eventsArg) => {
			let error = eventsArg.error;
			this.#emit({
				v: SCHEMA_VERSION,
				type: "build.error",
				ts: Date.now(),
				ok: false,
				durationMs: this.#getDuration(performance.now()),
				error: {
					message: error?.message,
					name: error?.name,
					filePath: findFilePath(error),
				},
			});
		});
	}
}
