class TemplateBehavior {
	#isRenderOptional;

	constructor(config) {
		this.write = true;

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

	isRenderable() {
		return this.renderableOverride ?? true;
	}

	isWriteable() {
		return this.write;
	}

	setFromPermalink(templatePermalink) {
		this.write = templatePermalink._writeToFileSystem;
	}
}
export default TemplateBehavior;
