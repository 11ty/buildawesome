import { isPlainObject } from "@11ty/eleventy-utils";

import { ResolveConfigurationData } from "./Data/ResolveConfigurationData.js";

class TemplateBehavior {
	#isRenderOptional;

	constructor(config) {
		this.render = true;
		this.write = true;
		this.outputFormat = null;

		if (!config) {
			throw new Error("Missing config argument in TemplateBehavior");
		}
		this.config = config;
	}

	// Render override set to false
	isRenderableDisabled() {
		return this.renderableOverride === false;
	}

	isRenderableOptional() {
		return this.#isRenderOptional;
	}

	// undefined (fallback), true, false
	setRenderableOverride(renderableOverride) {
		if (renderableOverride === "optional") {
			this.#isRenderOptional = true;
			this.renderableOverride = undefined;
		} else {
			this.#isRenderOptional = false;
			this.renderableOverride = renderableOverride;
		}
	}

	// permalink *has* a build key or output is json
	isRenderable() {
		return this.renderableOverride ?? (this.render || this.isRenderForced());
	}

	setOutputFormat(format) {
		this.outputFormat = format;
	}

	isRenderForced() {
		return this.outputFormat === "json";
	}

	isWriteable() {
		return this.write;
	}

	// Duplicate logic with TemplatePermalink constructor
	setRenderViaDataCascade(data) {
		// render is false *only* if `build` key does not exist in permalink objects (both in data and eleventyComputed)
		// (note that permalink: false means it won’t write but will still render)

		let keys = new Set();
		if (isPlainObject(data.permalink)) {
			for (let key of Object.keys(data.permalink)) {
				keys.add(key);
			}
		}

		let computedData = ResolveConfigurationData.getValue(data, this.config.keys.computed);
		let permalink = ResolveConfigurationData.getValue(computedData, this.config.keys.permalink);

		if (computedData && isPlainObject(permalink)) {
			for (let key of Object.keys(permalink)) {
				keys.add(key);
			}
		}

		if (keys.size) {
			this.render = keys.has("build");
		}
	}

	setFromPermalink(templatePermalink) {
		// this.render is duplicated between TemplatePermalink and `setRenderViaDataCascade` above
		this.render = templatePermalink._isRendered;

		this.write = templatePermalink._writeToFileSystem;
	}
}
export default TemplateBehavior;
