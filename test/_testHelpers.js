import { existsSync, rmSync } from "node:fs";
import { isPlainObject } from "@11ty/eleventy-utils";
import TemplateConfig from "../src/TemplateConfig.js";
import ProjectDirectories from "../src/Util/ProjectDirectories.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplatePassthroughManager from "../src/TemplatePassthroughManager.js";
import { Files } from "../src/Files.js";
import FileSystemSearch from "../src/FileSystemSearch.js";
import TemplateWriter from "../src/TemplateWriter.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";
import TemplateData from "../src/Data/TemplateData.js";
import ConsoleLogger from "../src/Util/ConsoleLogger.js";

export async function getTemplateConfigInstance(configObj, dirs, configObjOverride = undefined) {
	let $config;
	if(configObj instanceof TemplateConfig) {
		$config = configObj;
		configObj = undefined;

		if(!(dirs instanceof ProjectDirectories)) {
			throw new Error("Testing error: second argument to getTemplateConfigInstance must be a ProjectDirectories instance when the first argument is a TemplateConfig instance.")
		}
	} else {
		$config = new TemplateConfig();
	}

	$config.setProjectUsingEsm(true);

	if(!(dirs instanceof ProjectDirectories)) {
		dirs = new ProjectDirectories();
		if(isPlainObject(configObj) && !configObj.dir) {
			throw new Error("Testing error: missing `dir` property on config object literal passed in.")
		}
		dirs.setViaConfigObject(configObj?.dir || {});
	}

	$config.setDirectories(dirs);

	await $config.init(configObjOverride || configObj); // overrides

	return $config;
}

export async function getTemplateConfigInstanceCustomCallback(dirObject, configCallback) {
	let tmplCfg = new TemplateConfig();

	configCallback(tmplCfg.userConfig);

	let dirs = new ProjectDirectories();
	dirs.setViaConfigObject(dirObject);

	let $config = await getTemplateConfigInstance(tmplCfg, dirs, {
		dir: dirObject
	});
	return $config;
}

export function getTemplateWriterInstance(formats, templateConfig) {
  let logger = new ConsoleLogger();
  logger.isVerbose = false;

  let { eleventyFiles, passthroughManager } = getEleventyFilesInstance(formats, templateConfig);
  let templateWriter = new TemplateWriter(
    formats,
    null,
    templateConfig,
  );
  templateWriter.logger = logger;

  let engineManager = new TemplateEngineManager(templateConfig);
  let map = new ExtensionMap(templateConfig);
  map.engineManager = engineManager;
  map.setFormats(formats);

  templateWriter.extensionMap = map;

  templateWriter.setEleventyFiles(eleventyFiles);
  templateWriter.setPassthroughManager(passthroughManager);

  return {
    templateWriter,
    eleventyFiles,
    passthroughManager,
  }
}

export function getEleventyFilesInstance(formats, templateConfig) {
	let map = new ExtensionMap(templateConfig);
	map.setFormats(formats);

  let fss = new FileSystemSearch();
	let mgr = new TemplatePassthroughManager(templateConfig);

	mgr.extensionMap = map;
	mgr.setFileSystemSearch(fss);

	let files = new Files(formats, templateConfig);
	files.setPassthroughManager(mgr);
	files.setFileSystemSearch(fss);
	files.extensionMap = map;
  files.templateData = new TemplateData(templateConfig);
	files.init();

  return {
    eleventyFiles: files,
    passthroughManager: mgr,
  };
}

export function sortEleventyResults(a, b) {
  if(b.inputPath > a.inputPath) {
    return 1;
  } else if(b.inputPath < a.inputPath) {
    return -1;
  }
  return 0;
}

export function deleteDirectory(dir) {
  if(existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
}
