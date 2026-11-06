import { TemplatePath } from "@11ty/eleventy-utils";

class TemplateLayoutPathResolver {
	constructor(path, extensionMap, templateConfig) {
		if (!templateConfig) {
			throw new Error("Expected `templateConfig` in TemplateLayoutPathResolver constructor");
		}

		this.templateConfig = templateConfig;
		this.originalPath = path;
		this.originalDisplayPath =
			TemplatePath.join(this.layoutsDir, this.originalPath) +
			` (via \`layout: ${this.originalPath}\`)`; // for error messaging

		this.path = path;
		this.aliases = {};
		this.extensionMap = extensionMap;
		if (!extensionMap) {
			throw new Error("Expected `extensionMap` in TemplateLayoutPathResolver constructor.");
		}

		this.init();
	}

	getVirtualTemplate(layoutPath) {
		let inputDirRelativePath =
			this.templateConfig.directories.getLayoutPathRelativeToInputDirectory(layoutPath);
		return this.config.virtualTemplates[inputDirRelativePath];
	}

	get dirs() {
		return this.templateConfig.directories;
	}

	get inputDir() {
		return this.dirs.input;
	}

	get layoutsDir() {
		return this.dirs.layouts || this.dirs.includes;
	}

	/* Backwards compat */
	getLayoutsDir() {
		return this.layoutsDir;
	}

	setAliases() {
		this.aliases = Object.assign({}, this.config.layoutAliases, this.aliases);
	}

	// for testing
	set config(cfg) {
		this._config = cfg;
		this.init();
	}

	get config() {
		if (!this.templateConfig) {
			throw new Error("Internal error: Missing this.templateConfig");
		}

		return this.templateConfig.getConfig();
	}

	exists(layoutPath) {
		if (this.getVirtualTemplate(layoutPath)) {
			return true;
		}
		let fullPath = this.templateConfig.directories.getLayoutPath(layoutPath);
		let existsCache = this.templateConfig.existsCache;
		if (existsCache.exists(fullPath) && !existsCache.isDirectory(fullPath)) {
			// #4191
			return true;
		}
		return false;
	}

	init() {
		// we might be able to move this into the constructor?
		this.aliases = Object.assign({}, this.config.layoutAliases, this.aliases);

		if (this.aliases[this.path]) {
			this.path = this.aliases[this.path];
		}

		let useLayoutResolution = this.config.layoutResolution;

		if (this.path.split(".").length > 0 && this.exists(this.path)) {
			this.filename = this.path;
			this.fullPath = this.templateConfig.directories.getLayoutPath(this.path);
		} else if (useLayoutResolution) {
			this.filename = this.findFileName();
			this.fullPath = this.templateConfig.directories.getLayoutPath(this.filename || "");
		}
	}

	addLayoutAlias(from, to) {
		this.aliases[from] = to;
	}

	getFileName() {
		if (!this.filename) {
			throw new Error(
				`You’re trying to use a layout that does not exist: ${this.originalDisplayPath}`,
			);
		}

		return this.filename;
	}

	getFullPath() {
		if (!this.filename) {
			throw new Error(
				`You’re trying to use a layout that does not exist: ${this.originalDisplayPath}`,
			);
		}

		return this.fullPath;
	}

	findFileName() {
		for (let filename of this.extensionMap.getFileList(this.path)) {
			if (this.exists(filename)) {
				return filename;
			}
		}
	}

	getNormalizedLayoutKey() {
		return TemplatePath.stripLeadingSubPath(this.fullPath, this.layoutsDir);
	}
}

export default TemplateLayoutPathResolver;
