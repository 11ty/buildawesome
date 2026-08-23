import { CoreMinimal } from "./CoreMinimal.js";
import FileSystemSearch from "./FileSystemSearch.js";
import { Files } from "./Files.js";
import TemplatePassthroughManager from "./TemplatePassthroughManager.js";

// Core with File System support (but without Dev Server or Chokidar or Bundled Plugins)
export class CoreFs extends CoreMinimal {
	async initializeConfig(initOverrides) {
		await super.initializeConfig(initOverrides);

		/** @type {object} */
		this.fileSystemSearch = new FileSystemSearch();
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
