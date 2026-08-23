import ExtensionMap from "../src/ExtensionMap.js";
import Template from "../src/Template.js";
import FileSystemSearch from "../src/FileSystemSearch.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";

import { getTemplateConfigInstance } from "./_testHelpers.js";
import ConsoleLogger from "../src/Util/ConsoleLogger.js";

export default async function getNewTemplate(
  path,
  inputDir,
  outputDir,
  templateData = null,
  map = null,
  $config = null
) {
  if (!$config) {
    $config = await getTemplateConfigInstance({
      dir: {
        input: inputDir,
        output: outputDir,
      }
    });
  }

  let engineManager = new TemplateEngineManager($config);
  if (!map) {
    map = new ExtensionMap($config);
    map.setFormats(["liquid", "md", "njk", "html", "11ty.js"]);
    map.engineManager = engineManager;
  }
  if (templateData) {
    templateData.setFileSystemSearch(new FileSystemSearch());
    templateData.extensionMap = map;
  }
  let tmpl = new Template(path, templateData, map, $config);
  let logger = new ConsoleLogger();
  logger.isVerbose = false;
  tmpl.logger = logger;

  await tmpl.getTemplateRender();

  return tmpl;
}
