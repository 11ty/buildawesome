import { createDebug } from "./DebugLogUtil.js";

const debug = createDebug("Util:ProjectTemplateFormats");

class ProjectTemplateFormats {
	#useAll = {};
	#raw = {};

	#values = {}; // Set objects

	static union(...sets) {
		let s = new Set();

		for (let set of sets) {
			if (!set || typeof set[Symbol.iterator] !== "function") {
				continue;
			}
			for (let v of set) {
				s.add(v);
			}
		}

		return s;
	}

	#normalize(formats) {
		if (Array.isArray(formats)) {
			formats = "" + formats.join(",");
		}

		if (typeof formats !== "string") {
			throw new Error(
				`Invalid formats (expect String, Array) passed to ProjectTemplateFormats->normalize: ${formats}`,
			);
		}

		let final = new Set();
		for (let format of formats.split(",")) {
			format = format.trim();
			if (format && format !== "*") {
				final.add(format);
			}
		}

		return final;
	}

	isWildcard() {
		return this.#useAll.cli || this.#useAll.config || false;
	}

	/** @returns {boolean} */
	#isUseAll(rawFormats) {
		if (rawFormats === "") {
			return false;
		}

		if (typeof rawFormats === "string") {
			rawFormats = rawFormats.split(",");
		}

		if (Array.isArray(rawFormats)) {
			return rawFormats.find((entry) => entry === "*") !== undefined;
		}

		return false;
	}

	// 3.x Breaking: "" now means no formats. In 2.x and prior it meant "*"
	setViaCommandLine(formats) {
		if (formats === undefined) {
			return;
		}

		this.#useAll.cli = this.#isUseAll(formats);
		this.#raw.cli = formats;
		this.#values.cli = this.#normalize(formats);
	}

	// 3.x Breaking: "" now means no formats—in 2.x and prior it meant "*"
	// 3.x Adds support for comma separated string—in 2.x this required an Array
	setViaConfig(formats) {
		if (formats === undefined) {
			return;
		}

		// "*" is supported
		this.#useAll.config = this.#isUseAll(formats);
		this.#raw.config = formats;
		this.#values.config = this.#normalize(formats);
	}

	addViaConfig(formats) {
		if (!formats) {
			return;
		}

		if (this.#isUseAll(formats)) {
			throw new Error(
				`\`addTemplateFormats("*")\` is not supported for project template syntaxes.`,
			);
		}

		// "*" not supported here
		this.#raw.configAdd = formats;
		this.#values.configAdd = this.#normalize(formats);
	}

	getAllTemplateFormats() {
		return Array.from(ProjectTemplateFormats.union(this.#values.config, this.#values.configAdd));
	}

	getTemplateFormats() {
		if (this.#useAll.cli) {
			let v = this.getAllTemplateFormats();
			debug("Using CLI --formats='*': %o", v);
			return v;
		}

		if (this.#raw.cli !== undefined) {
			let v = Array.from(this.#values.cli);
			debug("Using CLI --formats: %o", v);
			return v;
		}

		let v = this.getAllTemplateFormats();
		debug(
			"Using configuration `templateFormats`, `setTemplateFormats()`, `addTemplateFormats()`: %o",
			v,
		);
		return v;
	}
}

export default ProjectTemplateFormats;
