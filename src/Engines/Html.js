import TemplateEngine from "./TemplateEngine.js";

export default class Html extends TemplateEngine {
	constructor(name, eleventyConfig) {
		super(name, eleventyConfig);
	}

	get cacheable() {
		return true;
	}

	// Preprocessing template engines run before this in the TemplateRender pipeline
	async compile(str) {
		return function () {
			return str;
		};
	}
}
