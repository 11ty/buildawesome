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

	static isPrematureTemplateContentError(e) {
		// TODO the rest of the template engines
		return (
			e instanceof TemplateContentPrematureUseError ||
			e?.cause instanceof TemplateContentPrematureUseError || // Custom (per Node-convention)
			(["RenderError", "UndefinedVariableError"].includes(e?.originalError?.name) &&
				e?.originalError?.originalError instanceof TemplateContentPrematureUseError) || // Liquid
			e?.message?.includes("TemplateContentPrematureUseError") // Nunjucks
		);
	}
}
