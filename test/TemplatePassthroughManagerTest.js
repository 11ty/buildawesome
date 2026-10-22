import test from "ava";
import fs from "fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import TemplatePassthroughManager from "../src/TemplatePassthroughManager.js";
import TemplateConfig from "../src/TemplateConfig.js";
import FileSystemSearch from "../src/FileSystemSearch.js";
import ExtensionMap from "../src/ExtensionMap.js";
import ProjectDirectories from "../src/Util/ProjectDirectories.js";
import Core from "../src/Core.js";

import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback, getEleventyFilesInstance, deleteDirectory } from "./_testHelpers.js";

test("Get paths from Config", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    img: { outputPath: true },
  };
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.deepEqual(mgr.getConfigPaths(), [{ inputPath: "./img", outputPath: true, isDynamicPattern: false, copyOptions: {} }]);
});

test("filterToPassthroughCopyFilesOnly", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    img: { outputPath: true },
    fonts: { outputPath: true },
  };
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  mgr.extensionMap = new ExtensionMap(eleventyConfig);

  t.deepEqual(mgr.filterToPassthroughCopyFilesOnly([]), []);
  t.deepEqual(mgr.filterToPassthroughCopyFilesOnly([], ""), []);
  t.deepEqual(mgr.filterToPassthroughCopyFilesOnly([], null), []);

  // eligible via config
  t.deepEqual(mgr.filterToPassthroughCopyFilesOnly([], "./img/test.png"), [{ copyOptions: {}, inputPath: "./img", isDynamicPattern: false, outputPath: true }]);
  t.deepEqual(mgr.filterToPassthroughCopyFilesOnly([], "./fonts/Roboto.woff"), [{ copyOptions: {}, inputPath: "./fonts", isDynamicPattern: false, outputPath: true }]);

  // when multiple paths are eligible via config, only return one path for both
  t.deepEqual(mgr.filterToPassthroughCopyFilesOnly([], ["./img/test.png", "./img/test2.png"]), [{ copyOptions: {}, inputPath: "./img", isDynamicPattern: false, outputPath: true }]);

  // not eligible via config
  t.deepEqual(mgr.filterToPassthroughCopyFilesOnly([], "./docs/test.njk"), []);
  t.deepEqual(mgr.filterToPassthroughCopyFilesOnly([], "./other-dir/test.png"), []);

  // not eligible via config, eligible via unknown engine listed in path
  t.deepEqual(mgr.filterToPassthroughCopyFilesOnly(["hi", "./other-dir/test.png"], "./other-dir/test.png"), ["./other-dir/test.png"]);
});

test("Get glob paths from config", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    "test/stubs/img": { outputPath: true },
    "test/stubs/img/**": { outputPath: "./" },
    "test/stubs/img/*.js": { outputPath: "./" },
  };
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.deepEqual(mgr.getConfigPathGlobs(), [
    "./test/stubs/img/**",
    "./test/stubs/img/**",
    "./test/stubs/img/*.js",
  ]);
});

test("Get file paths", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  mgr.extensionMap = new ExtensionMap(eleventyConfig);

  t.deepEqual(mgr.getNonTemplatePaths(["test.png"]), ["test.png"]);
});

test("Get file paths (filter out real templates)", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  mgr.extensionMap = new ExtensionMap(eleventyConfig);
  mgr.extensionMap.setFormats(["njk"]);

  t.deepEqual(mgr.getNonTemplatePaths(["test.njk"]), []);
});

test("Get file paths (filter out real templates), multiple", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  mgr.extensionMap = new ExtensionMap(eleventyConfig);
  mgr.extensionMap.setFormats(["njk"]);

  t.deepEqual(mgr.getNonTemplatePaths(["test.njk", "test.png"]), ["test.png"]);
});

test("Get file paths with a js file (filter out real templates), multiple", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  mgr.extensionMap = new ExtensionMap(eleventyConfig);
  mgr.extensionMap.setFormats(["njk"]);

  t.deepEqual(mgr.getNonTemplatePaths(["test.njk", "test.js"]), ["test.js"]);
});

// This test used to be for passthroughFileCopy: false in config
test("Get file paths (one image path)", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  mgr.extensionMap = new ExtensionMap(eleventyConfig);

  t.deepEqual(mgr.getNonTemplatePaths(["test.png"]), ["test.png"]);
});

test("Naughty paths outside of project dir", async (t) => {
  let dirs = new ProjectDirectories();
	dirs.setInput("./test/stubs/template-passthrough2/");
	dirs.setOutput("./test/stubs/template-passthrough2/_site/");

  let eleventyConfig = new TemplateConfig();
  eleventyConfig.setDirectories(dirs);
  eleventyConfig.userConfig.passthroughCopies = {
    "../static": { outputPath: true },
    "../*": { outputPath: "./" },
    "./test/stubs/template-passthrough2/static/*.css": { outputPath: "./" },
    "./test/stubs/template-passthrough2/static/*.js": { outputPath: "../../" },
    "./test/stubs/template-passthrough2/img.jpg": { outputPath: "../../" },
  };
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  mgr.setFileSystemSearch(new FileSystemSearch());

  await t.throwsAsync(async function () {
    for (let path of mgr.getConfigPaths()) {
      let pass = mgr.getTemplatePassthroughForPath(path);
      await mgr.copyPassthrough(pass);
    }
  }, {
    message: `Having trouble copying './test/stubs/template-passthrough2/static/*.js'`
  });

  const output = [
    "./test/stubs/template-passthrough2/_site/static",
    "./test/stubs/template-passthrough2/_site/nope.txt",
    "./test/stubs/template-passthrough2/_site/nope/",
    "./test/stubs/test.js",
    "./test/stubs/img.jpg",
  ];

  for (let path of output) {
    t.false(fs.existsSync(path));
  }
});

test("getAllNormalizedPaths", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    img: { outputPath: true },
  };
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  t.deepEqual(mgr.getAllNormalizedPaths(), [
    { inputPath: "./img", outputPath: true, isDynamicPattern: false, copyOptions: {} },
  ]);
});

test("getAllNormalizedPaths with globs", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    img: { outputPath: true },
    "img/**": { outputPath: "./" },
    "img/*.js": { outputPath: "./" },
  };
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  t.deepEqual(mgr.getAllNormalizedPaths(), [
    { inputPath: "./img", outputPath: true, isDynamicPattern: false, copyOptions: {} },
    { inputPath: "./img/**", outputPath: "", isDynamicPattern: true, copyOptions: {} },
    { inputPath: "./img/*.js", outputPath: "", isDynamicPattern: true, copyOptions: {} },
  ]);
});

test("getAliasesFromPassthroughResults with Unicode filenames", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  let results = [
    { map: { "./path/file": "_site/path/file" } },
    { map: { "./测试.用例/⌘": "_site/测试.用例/⌘" } },
    { map: { "./path/测试.用例": "_site/path/测试.用例" } },
    { map: { "./测试.用例/file": "_site/测试.用例/file" } },
  ]
  t.deepEqual(mgr.getAliasesFromPassthroughResults(results), {
    "/path/file": "./path/file",
    "/%E6%B5%8B%E8%AF%95.%E7%94%A8%E4%BE%8B/%E2%8C%98": "./测试.用例/⌘",
    "/path/%E6%B5%8B%E8%AF%95.%E7%94%A8%E4%BE%8B": "./path/测试.用例",
    "/%E6%B5%8B%E8%AF%95.%E7%94%A8%E4%BE%8B/file": "./测试.用例/file",
  });
});

test("Look for uniqueness on template passthrough paths #1677", async (t) => {
  let formats = [];

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/template-passthrough-duplicates/",
    output: "test/stubs/template-passthrough-duplicates/_site"
  }, function(cfg) {
    cfg.passthroughCopies = {
      "./test/stubs/template-passthrough-duplicates/input/**/*.png": {
        outputPath: "./",
      },
    };
  });

  let { passthroughManager } = getEleventyFilesInstance(formats, eleventyConfig);

  await t.throwsAsync(async function () {
    await passthroughManager.copyAll();
  }, {
    message: `Multiple passthrough copy files are trying to write to the same output file (./test/stubs/template-passthrough-duplicates/_site/avatar.png). ./test/stubs/template-passthrough-duplicates/input/avatar.png and ./test/stubs/template-passthrough-duplicates/input/src/views/avatar.png`
  });

  deleteDirectory("test/stubs/template-passthrough-duplicates/_site/");
});

test("Incremental passthrough, issue #3285", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.addPassthroughCopy({ './test/stubs-3285/src/scripts': 'scripts' });
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  mgr.setIncrementalFiles(["./test/stubs-3285/src/scripts/hello-world.js"]);

  t.deepEqual(mgr.getAllNormalizedPaths([]), [
    { copyOptions: {}, inputPath: "./test/stubs-3285/src/scripts", outputPath: "scripts", isDynamicPattern: false },
  ]);
});

test("Emulated passthrough copy sends entries and copies passthroughs that can’t be emulated", async (t) => {
  let payload;
  let outputDir = path.join(mkdtempSync(path.join(tmpdir(), "passthrough-entries-")), "_site");
  let core = new Core("test/stubs/template-passthrough", outputDir, {
    runMode: "serve",
    quietMode: true,
    configPath: false,
    config(eleventyConfig) {
      eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
      eleventyConfig.addPassthroughCopy({ "test/stubs/template-passthrough/static": "static" }, { junk: true });
      eleventyConfig.addPassthroughCopy({ "test/stubs/template-passthrough/img.jpg": "img.jpg" });
      eleventyConfig.addPassthroughCopy({ "test/stubs/template-passthrough/src/views": "views" }, {
        rename: (p) => p.replace("avatar", "renamed"),
      });
      eleventyConfig.on("buildawesome.passthrough", (data) => {
        payload = data;
      });
    },
  });
  core.disableLogger();
  await core.write();

  t.deepEqual(payload.entries, [
    { url: "/static", inputPath: "./test/stubs/template-passthrough/static/", dot: true, junk: true },
    { url: "/img.jpg", inputPath: "./test/stubs/template-passthrough/img.jpg", dot: true, junk: false },
  ]);
  t.true(Object.keys(payload.map).includes("/static"));
  t.true(fs.existsSync(path.join(outputDir, "views/renamed.png")));
  t.false(fs.existsSync(path.join(outputDir, "static")));
});

test("Emulated incremental passthrough only includes what changed", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.setServerPassthroughCopyBehavior("passthrough");
  eleventyConfig.userConfig.addPassthroughCopy({ "./test/stubs-3285/src/scripts": "scripts" });
  eleventyConfig.userConfig.addPassthroughCopy({ "./test/stubs/template-passthrough/static": "static" }, { rename: (p) => p });
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  mgr.setRunMode("serve");

  // a template changed
  mgr.setIncrementalFiles(["./test/stubs/template-passthrough/index.njk"]);
  t.deepEqual(mgr.getAllNormalizedPaths([]), []);

  // a passthrough that can’t be emulated changed
  mgr.setIncrementalFiles(["./test/stubs/template-passthrough/static/test.css"]);
  t.deepEqual(mgr.getAllNormalizedPaths([]).map((p) => p.inputPath), ["./test/stubs/template-passthrough/static"]);
});

test("setPassthroughCopyOptions sets defaults that per-call options override", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.setPassthroughCopyOptions({ junk: true, dot: false });
  eleventyConfig.userConfig.addPassthroughCopy("img");
  eleventyConfig.userConfig.addPassthroughCopy("static", { dot: true });
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  t.deepEqual(mgr.getConfigPaths().map((p) => p.copyOptions), [
    { junk: true, dot: false },
    { junk: true, dot: true },
  ]);
});

test("setPassthroughCopyOptions applies to copied files", async (t) => {
  let outputDir = path.join(mkdtempSync(path.join(tmpdir(), "passthrough-defaults-")), "_site");
  let core = new Core("test/stubs/template-passthrough", outputDir, {
    quietMode: true,
    configPath: false,
    config(eleventyConfig) {
      eleventyConfig.setPassthroughCopyOptions({ dot: false });
      eleventyConfig.addPassthroughCopy({ "test/stubs/template-passthrough": "copy" });
    },
  });
  core.disableLogger();
  await core.write();

  t.true(fs.existsSync(path.join(outputDir, "copy/img.jpg")));
  t.false(fs.existsSync(path.join(outputDir, "copy/.htaccess")));
});

test("setPassthroughCopyOptions with `rename` disables dev server emulation", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.setServerPassthroughCopyBehavior("passthrough");
  eleventyConfig.userConfig.setPassthroughCopyOptions({ rename: (p) => p });
  eleventyConfig.userConfig.addPassthroughCopy("img");
  await eleventyConfig.init();

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  t.deepEqual(mgr.getConfigPathGlobs(true), []);
  t.deepEqual(mgr.getConfigPathGlobs(false), ["./img"]);
});
