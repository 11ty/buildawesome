import { globSync } from "tinyglobby";
import { TemplatePath } from "@11ty/eleventy-utils";

import { CoreMinimal } from "./CoreMinimal.js";
import FileSystemSearch from "./FileSystemSearch.js";
import { Files } from "./Files.js";
import TemplatePassthroughManager from "./TemplatePassthroughManager.js";
import { isDynamicPattern } from "./Util/GlobMatcher.js";

// Core with File System support (but without Dev Server or Chokidar or Bundled Plugins)
export class CoreFs extends CoreMinimal {
	async initializeConfig(initOverrides) {
		await super.initializeConfig(initOverrides);

		this.eleventyConfig.existsCache.allowCaseCollisions = this.checkErrorReporting(
			"caseCollisions",
			"allow",
		);
		this.eleventyConfig.directories.checkCase(this.eleventyConfig.existsCache);
		this.eleventyConfig.directories.checkInputRelative(this.eleventyConfig.existsCache);

		/** @type {object} */
		this.fileSystemSearch = new FileSystemSearch(this.eleventyConfig.existsCache);
	}

	async init(options = {}) {
		await super.init(options);

		this.templateData.setFileSystemSearch(this.fileSystemSearch);

		this.passthroughManager = new TemplatePassthroughManager(this.eleventyConfig);
		this.passthroughManager.setRunMode(this.runMode);
		this.passthroughManager.setDryRun(this.isDryRun);
		this.passthroughManager.extensionMap = this.extensionMap;
		this.passthroughManager.setFileSystemSearch(this.fileSystemSearch);

		let formats = this.templateFormats.getTemplateFormats();
		this.eleventyFiles = new Files(formats, this.eleventyConfig);
		this.eleventyFiles.setPassthroughManager(this.passthroughManager);
		this.eleventyFiles.setFileSystemSearch(this.fileSystemSearch);
		this.eleventyFiles.setRunMode(this.runMode);
		this.eleventyFiles.extensionMap = this.extensionMap;
		// This needs to be set before init or it’ll construct a new one
		this.eleventyFiles.templateData = this.templateData;
		this.eleventyFiles.init();

		this.writer.setPassthroughManager(this.passthroughManager);
		this.writer.setEleventyFiles(this.eleventyFiles);
	}

	/**
	 * Set the files that need to be rendered/compiled/written for an incremental build.
	 * Adds glob pattern support (e.g. `--incremental=src/*.md`) to the base method.
	 *
	 * @method
	 * @param {Array|string} incrementalFiles - File paths or glob patterns
	 */
	setIncrementalFiles(incrementalFiles) {
		let files = incrementalFiles;
		if (typeof files === "string") {
			files = files.split(",");
		}

		if (Array.isArray(files)) {
			let globs = [];
			let paths = [];
			for (let entry of files) {
				if (isDynamicPattern(entry)) {
					globs.push(TemplatePath.stripLeadingDotSlash(entry));
				} else {
					// Pass through untouched, a deleted file still needs to trigger a build
					paths.push(entry);
				}
			}

			if (globs.length > 0) {
				let matches = globSync(globs, {
					dot: true,
					caseSensitiveMatch: false,
					ignore: ["**/node_modules/**", ".git/**"],
				});

				if (matches.length === 0) {
					this.logger.warn(
						`No files matched the incremental glob pattern: ${globs.join(", ")}${paths.length === 0 ? " (a full build will run instead)" : ""}`,
					);
				}

				files = paths.concat(matches.map((entry) => TemplatePath.standardizeFilePath(entry)));
			}
		}

		super.setIncrementalFiles(files);
	}

	/**
	 * Restarts Eleventy.
	 */
	async restart() {
		await super.restart();

		// TODO
		this.passthroughManager.reset();
		// TODO
		this.eleventyFiles.restart();
	}
}
