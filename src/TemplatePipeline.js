import BaseError from "./Errors/BaseError.js";
import { createDebug } from "./Util/DebugLogUtil.js";

const debugConfiguration = createDebug("UserConfig");

class TemplatePipelineUnsupportedError extends BaseError {}

// Allow list of output format chains, in execution order. One template engine may run before a chain.
const FORMAT_CHAINS = [["md"], ["html"]];

// Configuration key for the template engine that runs before a chain starting with this format
const PREPROCESSOR_CONFIG_KEYS = {
	md: "markdownTemplateEngine",
	html: "htmlTemplateEngine",
};

// No conversion: dropped from template syntax lists and treated as “no preprocessing”
const PLAINTEXT_FORMAT = "html";

export class TemplatePipeline {
	static PLAINTEXT_FORMAT = PLAINTEXT_FORMAT;

	static isFormat(name) {
		return FORMAT_CHAINS.some((chain) => chain.includes(name));
	}

	static #isEqualChain(chain, formats) {
		return chain.length === formats.length && chain.every((name, j) => name === formats[j]);
	}

	// The default chain for templates whose engine is `format`
	static getChain(format) {
		return FORMAT_CHAINS.find((chain) => chain.at(-1) === format);
	}

	// Template engine name (or `false`) that runs before `chain` by default
	static getPreprocessor(chain, config) {
		let [format] = chain;
		let key = PREPROCESSOR_CONFIG_KEYS[format];
		let name = key ? config[key] : false;

		if (name === format) {
			debugConfiguration(
				"Misconfiguration warning: the preprocessing template syntax for %o files cannot be %o, we’re assuming you meant `false` to skip preprocessing altogether (via the %o configuration property). Read more: https://www.11ty.dev/docs/config/#default-template-engine-for-markdown-files",
				format,
				name,
				key,
			);
			return false;
		}
		if (name === PLAINTEXT_FORMAT) {
			return false;
		}
		if (TemplatePipeline.isFormat(name)) {
			throw new TemplatePipelineUnsupportedError(
				`The \`${key}\` configuration property must be a template engine, received the output format: ${name}`,
			);
		}

		return name || false;
	}

	// Template syntax (e.g. `njk,md`) to step names in execution order, throws on unsupported combinations
	static parse(syntax) {
		if (typeof (syntax || "") !== "string") {
			throw new Error("Expected String passed to TemplatePipeline.parse. Received: " + syntax);
		}

		let names = new Set(
			(syntax || "")
				.split(",")
				.map((name) => name.toLowerCase().trim())
				.filter((name) => name && name !== PLAINTEXT_FORMAT),
		);

		let templates = [...names].filter((name) => !TemplatePipeline.isFormat(name));
		let formats = [...names].filter((name) => TemplatePipeline.isFormat(name));

		if (templates.length > 1) {
			throw new TemplatePipelineUnsupportedError(
				`Don’t mix multiple templating engines in your front matter overrides (exceptions for HTML and Markdown). You used: ${syntax}`,
			);
		}

		if (formats.length === 0) {
			return templates;
		}

		// Order comes from the allow list, not the syntax string
		let chain = FORMAT_CHAINS.find(
			(chain) => chain.length === formats.length && formats.every((name) => chain.includes(name)),
		);
		if (!chain) {
			throw new TemplatePipelineUnsupportedError(
				`Unsupported output format combination in template syntax: ${syntax}`,
			);
		}

		return [...templates, ...chain];
	}

	// Throws if step names (in execution order) aren’t one optional template engine followed by an allowed chain
	static validate(steps) {
		let firstFormatIndex = steps.findIndex((name) => TemplatePipeline.isFormat(name));
		let templates = firstFormatIndex === -1 ? steps : steps.slice(0, firstFormatIndex);
		let formats = firstFormatIndex === -1 ? [] : steps.slice(firstFormatIndex);

		if (templates.length > 1) {
			throw new TemplatePipelineUnsupportedError(
				`Only one template engine may run in a template pipeline, received: ${steps.join(",")}`,
			);
		}

		if (
			formats.length > 0 &&
			!FORMAT_CHAINS.some((chain) => TemplatePipeline.#isEqualChain(chain, formats))
		) {
			throw new TemplatePipelineUnsupportedError(
				`Unsupported template pipeline: ${steps.join(",")}`,
			);
		}
	}
}
