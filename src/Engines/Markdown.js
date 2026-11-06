import markdownIt from "markdown-it";

import TemplateEngine from "./TemplateEngine.js";

export default class Markdown extends TemplateEngine {
	constructor(name, eleventyConfig) {
		super(name, eleventyConfig);

		this.markdownOptions = {};

		this.setLibrary(this.config.libraryOverrides.md);
	}

	get cacheable() {
		return true;
	}

	setLibrary(mdLib) {
		this.mdLib = mdLib || markdownIt(this.getMarkdownOptions());

		// Overrides a highlighter set in `markdownOptions`
		// This is separate so devs can pass in a new mdLib and still use the official eleventy plugin for markdown highlighting
		if (this.config.markdownHighlighter && typeof this.mdLib.set === "function") {
			this.mdLib.set({
				highlight: this.config.markdownHighlighter,
			});
		}

		if (typeof this.mdLib.disable === "function") {
			// Disable indented code blocks by default (Issue #2438)
			this.mdLib.disable("code");
		}

		this.setEngineLib(this.mdLib, Boolean(this.config.libraryOverrides.md));
	}

	setMarkdownOptions(options) {
		this.markdownOptions = options;
	}

	getMarkdownOptions() {
		// work with "mode" presets https://github.com/markdown-it/markdown-it#init-with-presets-and-options
		if (typeof this.markdownOptions === "string") {
			return this.markdownOptions;
		}

		return Object.assign(
			{
				html: true,
			},
			this.markdownOptions || {},
		);
	}

	// Preprocessing template engines run before this in the TemplateRender pipeline
	async compile(str) {
		let mdlib = this.mdLib;
		return function (data) {
			return mdlib.render(str, data);
		};
	}
}
