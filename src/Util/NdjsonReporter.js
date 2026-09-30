// Bump on a breaking change
const SCHEMA_VERSION = 1;

/** @param {object} event */
function emit(event) {
	process.stdout.write(JSON.stringify(event) + "\n");
}

/** @param {object} result */
function toManifestEntry(result) {
	return {
		inputPath: result?.inputPath,
		outputPath: result?.outputPath,
		url: result?.url,
	};
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

/** Build events on stdout, logs on stderr (--reporter=ndjson) */
class NdjsonReporter {
	/** @type {number|undefined} */
	#startedAt;

	#getDuration(ts) {
		return this.#startedAt !== undefined ? ts - this.#startedAt : undefined;
	}

	/** @param {object} userConfig */
	config(userConfig) {
		userConfig.on("buildawesome.before", (arg) => {
			this.#startedAt = Date.now();
			emit({
				v: SCHEMA_VERSION,
				type: "build.start",
				ts: this.#startedAt,
				runMode: arg?.runMode,
				incremental: Boolean(arg?.incremental),
			});
		});

		userConfig.on("buildawesome.after", (arg) => {
			let ts = Date.now();
			emit({
				v: SCHEMA_VERSION,
				type: "build.end",
				ts,
				ok: true,
				durationMs: this.#getDuration(ts),
				pages: (arg?.results || []).map(toManifestEntry),
			});
		});

		// Watch mode doesn’t exit on error
		userConfig.on("buildawesome.aftererror", (arg) => {
			let ts = Date.now();
			let error = arg?.error;
			emit({
				v: SCHEMA_VERSION,
				type: "build.error",
				ts,
				ok: false,
				durationMs: this.#getDuration(ts),
				error: {
					message: error?.message,
					name: error?.name,
					filePath: findFilePath(error),
				},
			});
		});
	}

	/** @param {object} core */
	installLogger(core) {
		core.logger.overrideLogger(new console.Console(process.stderr, process.stderr));
	}
}

export default NdjsonReporter;
