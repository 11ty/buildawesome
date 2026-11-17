import TemplateContentPrematureUseError from "./TemplateContentPrematureUseError.js";

/* Hack to workaround the variety of error handling schemes in template languages */
export default class ErrorUtil {
	static get prefix() {
		return ">>>>>11ty>>>>>";
	}
	static get suffix() {
		return "<<<<<11ty<<<<<";
	}

	static hasEmbeddedError(msg) {
		if (!msg) {
			return false;
		}

		return msg.includes(ErrorUtil.prefix) && msg.includes(ErrorUtil.suffix);
	}

	static cleanMessage(msg) {
		if (!msg) {
			return "";
		}

		if (!ErrorUtil.hasEmbeddedError(msg)) {
			return "" + msg;
		}

		return msg.slice(0, Math.max(0, msg.indexOf(ErrorUtil.prefix)));
	}

	static deconvertErrorToObject(error) {
		if (!error || !error.message) {
			throw new Error(`Could not convert error object from: ${error}`);
		}
		if (!ErrorUtil.hasEmbeddedError(error.message)) {
			return error;
		}

		let msg = error.message;
		let objectString = msg.substring(
			msg.indexOf(ErrorUtil.prefix) + ErrorUtil.prefix.length,
			msg.lastIndexOf(ErrorUtil.suffix),
		);
		let obj = JSON.parse(objectString);
		obj.name = error.name;
		return obj;
	}

	// pass an error through a random template engine’s error handling unscathed
	static convertErrorToString(error) {
		return (
			ErrorUtil.prefix +
			JSON.stringify({ message: error.message, stack: error.stack }) +
			ErrorUtil.suffix
		);
	}

	static #lineOffsetErrors = new WeakSet();

	// Shifts Liquid and Nunjucks line numbers reported for `filePath` by `offset` lines.
	static offsetLineNumbers(e, filePath, offset) {
		if (!offset || !filePath) {
			return;
		}

		let seen = new Set();
		// Liquid errors use `originalError` instead of `cause`.
		for (let error = e; error && !seen.has(error); error = error.cause ?? error.originalError) {
			seen.add(error);
			if (ErrorUtil.#lineOffsetErrors.has(error) || typeof error.message !== "string") {
				continue;
			}

			// Liquid appends `, line:N, col:N` from the token position.
			if (typeof error.token?.getPosition === "function" && error.token.file === filePath) {
				let [line, col] = error.token.getPosition();
				let suffix = `, line:${line}, col:${col}`;
				if (error.message.endsWith(suffix)) {
					error.message =
						error.message.slice(0, -suffix.length) + `, line:${line + offset}, col:${col}`;
					ErrorUtil.#lineOffsetErrors.add(error);
				}
				continue;
			}

			// Nunjucks prefixes `(path) [Line N` for the template where the error occurred.
			let prefix = `(${filePath}) [Line `;
			if (error.message.startsWith(prefix)) {
				let lineStr = String(parseInt(error.message.slice(prefix.length), 10));
				if (lineStr !== "NaN" && error.message.startsWith(prefix + lineStr)) {
					let line = Number(lineStr);
					error.message =
						prefix + (line + offset) + error.message.slice(prefix.length + lineStr.length);
					if (error.lineno === line) {
						error.lineno += offset;
					}
					ErrorUtil.#lineOffsetErrors.add(error);
				}
			}
		}
	}

	static isPrematureTemplateContentError(e) {
		let seen = new Set();
		// Liquid errors use `originalError` instead of `cause`.
		for (let error = e; error && !seen.has(error); error = error.cause ?? error.originalError) {
			if (error instanceof TemplateContentPrematureUseError) {
				return true;
			}
			seen.add(error);
		}

		return false;
	}
}
