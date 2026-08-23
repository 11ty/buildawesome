import test from "ava";
import { glob } from "tinyglobby";

import TemplateConfig from "../src/TemplateConfig.js";
import TemplatePassthroughManager from "../src/TemplatePassthroughManager.js";
import ProjectDirectories from "../src/Util/ProjectDirectories.js";
import { isTypeScriptSupported } from "../src/Util/TypeScriptFeatureTest.cjs";

import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback, getEleventyFilesInstance } from "./_testHelpers.js";

test("Dirs paths", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "src",
      includes: "includes",
      data: "data",
      output: "dist",
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);

  t.deepEqual(evf.inputDir, "./src/");
  t.deepEqual(evf.includesDir, "./src/includes/");
  t.deepEqual(evf.getDataDir(), "./src/data/");
  t.deepEqual(evf.outputDir, "./dist/");
});

test("Dirs paths (relative)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "src",
      includes: "../includes",
      data: "../data",
      output: "dist",
    },
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);

  t.deepEqual(evf.inputDir, "./src/");
  t.deepEqual(evf.includesDir, "./includes/");
  t.deepEqual(evf.getDataDir(), "./data/");
  t.deepEqual(evf.outputDir, "./dist/");
});

test("getFiles", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/writeTest",
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid", "md"], $config);

  t.deepEqual(await evf.getFiles(), ["./test/stubs/writeTest/test.md"]);
});

test("getFiles (without 11ty.js)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/writeTestJS"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid", "md"], $config);

  t.deepEqual(await evf.getFiles(), []);
});

test("getFiles (with 11ty.js)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/writeTestJS",
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid", "md", "11ty.js"], $config);

  t.deepEqual(await evf.getFiles(), ["./test/stubs/writeTestJS/test.11ty.cjs"]);
});

test("getFiles (with js, treated as passthrough copy)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/writeTestJS-passthrough",
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid", "md", "js", "11ty.js"], $config);

  const files = await evf.getFiles();
  t.deepEqual(
    files.sort(),
    [
      "./test/stubs/writeTestJS-passthrough/sample.js",
      "./test/stubs/writeTestJS-passthrough/test.11ty.js",
    ].sort()
  );

  t.false(evf.extensionMap.hasEngine("./test/stubs/writeTestJS-passthrough/sample.js"));
  t.true(evf.extensionMap.hasEngine("./test/stubs/writeTestJS-passthrough/test.11ty.js"));
});

test("getFiles (with case insensitivity)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/writeTestJS-casesensitive",
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["11ty.js", "JS"], $config);

  t.deepEqual(
    (await evf.getFiles()).sort(),
    [
      "./test/stubs/writeTestJS-casesensitive/sample.Js",
      "./test/stubs/writeTestJS-casesensitive/test.11Ty.js",
    ].sort()
  );
  t.false(evf.extensionMap.hasEngine("./test/stubs/writeTestJS-casesensitive/sample.Js"));
  t.true(evf.extensionMap.hasEngine("./test/stubs/writeTestJS-casesensitive/test.11Ty.js"));
});

test("Mutually exclusive Input and Output dirs", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/writeTest",
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid", "md"], $config);

  let files = await glob(evf.getFileGlobs());
  t.deepEqual(evf.getRawFiles(), ["./test/stubs/writeTest/**/*.{liquid,md}"]);
  t.true(files.length > 0);
  t.is(files[0], "test/stubs/writeTest/test.md");
});

test("Single File Input (deep path)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/index.html",
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid", "md"], $config);

  let files = await glob(evf.getFileGlobs());
  t.is(evf.getRawFiles().length, 1);
  t.is(files.length, 1);
  t.is(files[0], "test/stubs/index.html");
});

test("Single File Input (shallow path)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "README.md",
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["md"], $config);

  let globs = evf.getFileGlobs(); //.filter((path) => path !== "./README.md");
  let files = await glob(globs, {
    ignore: evf.getIgnoreGlobs(),
  });
  t.is(evf.getRawFiles().length, 1);
  t.is(files.length, 1);
  t.is(files[0], "README.md");
});

test("Glob Input", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/glob-pages/!(contact.md)",
    }
  });
  let { eleventyFiles: evf } = getEleventyFilesInstance(["md"], $config);

  let globs = evf.getFileGlobs();
  let files = await glob(globs);

  t.is(files.length, 2);
  t.is(files[0], "test/stubs/glob-pages/about.md");
  t.is(files[1], "test/stubs/glob-pages/home.md");
});

test(".eleventyignore parsing", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/",
    }
  });
  let { eleventyFiles: evf } = getEleventyFilesInstance(["md"], $config);

  let ignores = evf.getFileIgnores("./test/stubs/.eleventyignore");
  t.is(ignores.length, 2);
  t.is(ignores[0], "./test/stubs/ignoredFolder/**");
  t.is(ignores[1], "./test/stubs/ignoredFolder/ignored.md");
});

test("Parse multiple .eleventyignores", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./test/stubs/multiple-ignores/",
    }
  });
  let { eleventyFiles: evf } = getEleventyFilesInstance(["md"], $config);

  let ignores = evf.getFileIgnores([
    "./test/stubs/multiple-ignores/.eleventyignore",
    "./test/stubs/multiple-ignores/subfolder/.eleventyignore",
  ]);
  t.is(ignores.length, 4);
  // Note these folders must exist!
  t.is(ignores[0], "./test/stubs/multiple-ignores/ignoredFolder/**");
  t.is(ignores[1], "./test/stubs/multiple-ignores/ignoredFolder/ignored.md");
  t.is(ignores[2], "./test/stubs/multiple-ignores/subfolder/ignoredFolder2/**");
  t.is(ignores[3], "./test/stubs/multiple-ignores/subfolder/ignoredFolder2/ignored2.md");
});

test("Passed file name does not exist", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "./",
    }
  });
  let { eleventyFiles: evf } = getEleventyFilesInstance(["md"], $config);

  let ignores = evf.getFileIgnores(".thisfiledoesnotexist");
  t.deepEqual(ignores, []);
});

test(".eleventyignore files", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs"
    }
  });
  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid", "md"], $config);

  let ignoredFiles = await glob("test/stubs/ignoredFolder/*.md");
  t.is(ignoredFiles.length, 1);

  let files = await glob(evf.getFileGlobs(), {
    ignore: evf.getIgnoreGlobs(),
  });

  t.true(files.length > 0);

  t.is(
    files.filter((file) => {
      return file.indexOf("./test/stubs/ignoredFolder") > -1;
    }).length,
    0
  );
});

test("getTemplateData caching", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf.init();
  let templateDataFirstCall = evf.templateData;
  let templateDataSecondCall = evf.templateData;
  t.is(templateDataFirstCall, templateDataSecondCall);
});

test("getDataDir", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "."
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf.init();
  t.is(evf.getDataDir(), "./_data/");
});

test("getDataDir subdir", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf.init();
  t.is(evf.getDataDir(), "./test/stubs/_data/");
});

test("Include and Data Dirs", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs"
    }
  });
  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf.init();

  t.deepEqual(evf.getIncludesAndDataDirs(), [
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
  ]);
});

test("Input to 'src' and empty includes dir (issue #403)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "src"
    }
  });
  let { eleventyFiles: evf } = getEleventyFilesInstance(["md", "liquid", "html"], $config);
  evf._setEleventyIgnoreContent("!./src/_includes/**");
  evf._setConfig({
    useGitIgnore: false,
    dir: {
      input: ".",
      output: "_site",
      includes: "",
      data: "_data",
    },
  });
  evf.init(); // duplicate init

  t.deepEqual(evf.getFileGlobs(), [
    "./src/**/*.{md,liquid,html}",
    // "!./src/_includes/**",
    // "!./src/_site/**",
    // "!./src/_data/**",
  ]);
});

test("Glob Watcher Files", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["njk"], $config);

  t.deepEqual(evf.getGlobWatcherFiles(), [
    "./test/stubs/**/*.njk",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
  ]);
});

test("Glob Watcher Files with File Extension Passthroughs", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs"
    }
  });
  let { eleventyFiles: evf } = getEleventyFilesInstance(["njk", "png"], $config);

  t.deepEqual(evf.getGlobWatcherFiles(), [
    "./test/stubs/**/*.njk",
    "./test/stubs/**/*.png",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
  ]);
});

test("Glob Watcher Files with File Extension Passthroughs with Dev Server (for free passthrough copy #2456)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs"
    }
  });

  $config.userConfig.setServerPassthroughCopyBehavior("passthrough");
  $config.config.serverPassthroughCopyBehavior = "passthrough";

  let { eleventyFiles: evf } = getEleventyFilesInstance(["njk", "png"], $config);
  evf.setRunMode("serve");
  evf.init(); // duplicate init

  t.deepEqual(evf.getGlobWatcherFiles(), [
    "./test/stubs/**/*.njk",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
  ]);

  t.deepEqual(evf.getGlobWatcherFilesForPassthroughCopy(), ["./test/stubs/**/*.png"]);
});

test("Glob Watcher Files with Config Passthroughs (one template format)", async (t) => {
  let $config = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "test/stubs/_site"
  }, function(cfg) {
		cfg.passthroughCopies = {
			"test/stubs/img/": { outputPath: true },
		};
	});


  let { eleventyFiles: evf } = getEleventyFilesInstance(["njk"], $config);

  t.deepEqual(evf.getGlobWatcherFiles(), [
    "./test/stubs/**/*.njk",
    "./test/stubs/img/**",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
  ]);
});

test("Glob Watcher Files with Config Passthroughs (one template format) with Dev Server (for free passthrough copy #2456)", async (t) => {
  let $config = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.setServerPassthroughCopyBehavior("passthrough");

		cfg.passthroughCopies = {
			"test/stubs/img/": { outputPath: true },
		};
	});

  let { eleventyFiles: evf } = getEleventyFilesInstance(["njk"], $config);
  evf.setRunMode("serve");
  evf.init(); // duplicate init

  let mgr = new TemplatePassthroughManager($config);
  evf.setPassthroughManager(mgr);

  t.deepEqual(evf.getGlobWatcherFiles(), [
    "./test/stubs/**/*.njk",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
  ]);

  t.deepEqual(evf.getGlobWatcherFilesForPassthroughCopy(), ["./test/stubs/img/**"]);
});

test("Glob Watcher Files with Config Passthroughs (no template formats)", async (t) => {
  let templateConfig = new TemplateConfig();
  let projectDirs = new ProjectDirectories();
  projectDirs.setViaConfigObject({
    input: "test/stubs"
  });
  let $config = await getTemplateConfigInstance(templateConfig, projectDirs);

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf.init();

  t.deepEqual(await evf.getGlobWatcherTemplateDataFiles(), [
    `./test/stubs/**/*.{json,data.mjs,data.cjs,data.js,data.mts,data.cts,data.ts,11tydata.mjs,11tydata.cjs,11tydata.js,11tydata.mts,11tydata.cts,11tydata.ts}`,
  ]);
});

test("Test that negations are ignored (for now) PR#709, will change when #693 is implemented", async (t) => {
  let templateConfig = new TemplateConfig();
  let projectDirs = new ProjectDirectories();
  projectDirs.setViaConfigObject({
    input: "test/stubs"
  });
  let $config = await getTemplateConfigInstance(templateConfig, projectDirs);
  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);

  t.deepEqual(
    evf.normalizeIgnoreContent(
      "./",
      `hello
!testing`
    ),
    ["./hello"]
  );
});
