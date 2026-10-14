import test from "ava";
import { TemplatePath } from "@11ty/eleventy-utils";

import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback, getEleventyFilesInstance } from "./_testHelpers.js";

/* .eleventyignore and .gitignore combos */

test("Get ignores (no .eleventyignore no .gitignore)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/ignore1",
      output: "test/stubs/ignore1/_site"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf._setLocalPathRoot("./test/stubs/ignorelocalroot");

  t.deepEqual(evf.getIgnores(), [
    "./test/stubs/ignorelocalroot/test.md",
    "./test/stubs/ignore1/_site/**",
  ]);

  t.deepEqual(evf.getIgnoreGlobs().slice(-2), [
    "**/node_modules/**",
    "./test/stubs/ignorelocalroot/.git/**",
  ]);
});

test("Get ignores (no .eleventyignore)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/ignore2",
      output: "test/stubs/ignore2/_site"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf._setLocalPathRoot("./test/stubs/ignorelocalrootgitignore");

  t.deepEqual(evf.getIgnores(), [
    "./test/stubs/ignorelocalrootgitignore/thisshouldnotexist12345",
    "./test/stubs/ignorelocalrootgitignore/test.md",
    "./test/stubs/ignore2/_site/**",
  ]);

  t.deepEqual(evf.getIgnoreGlobs().slice(-2), [
    "**/node_modules/**",
    "./test/stubs/ignorelocalrootgitignore/.git/**",
  ]);
});

test("Get ignores (no .eleventyignore, using setUseGitIgnore(false))", async (t) => {
  let $config = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/ignore2",
    output: "test/stubs/ignore2/_site",
  }, function($config) {
    $config.setUseGitIgnore(false);
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf._setLocalPathRoot("./test/stubs/ignorelocalroot");

  t.deepEqual(evf.getIgnores(), [
    "./test/stubs/ignorelocalroot/test.md",
    "./test/stubs/ignore2/_site/**",
  ]);

  t.deepEqual(evf.getIgnoreGlobs().slice(-2), [
		"**/node_modules/**",
		"./test/stubs/ignorelocalroot/.git/**",
	]);
});

test("Get ignores (no .gitignore)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/ignore3",
      output: "test/stubs/ignore3/_site"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf._setLocalPathRoot("./test/stubs/ignorelocalroot");

  t.deepEqual(evf.getIgnores(), [
    "./test/stubs/ignorelocalroot/test.md",
    "./test/stubs/ignore3/ignoredFolder/**",
    "./test/stubs/ignore3/ignoredFolder/ignored.md",
    "./test/stubs/ignore3/_site/**",
  ]);

  t.deepEqual(evf.getIgnoreGlobs().slice(-2), [
    "**/node_modules/**",
    "./test/stubs/ignorelocalroot/.git/**",
  ]);
});

test("Get ignores (project .eleventyignore and root .gitignore)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/ignore4",
      output: "test/stubs/ignore4/_site"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf._setLocalPathRoot("./test/stubs/ignorelocalrootgitignore");

  t.deepEqual(evf.getIgnores(), [
    "./test/stubs/ignorelocalrootgitignore/thisshouldnotexist12345",
    "./test/stubs/ignorelocalrootgitignore/test.md",
    "./test/stubs/ignore4/ignoredFolder/**",
    "./test/stubs/ignore4/ignoredFolder/ignored.md",
    "./test/stubs/ignore4/_site/**",
  ]);

  t.deepEqual(evf.getIgnoreGlobs().slice(-2), [
    "**/node_modules/**",
    "./test/stubs/ignorelocalrootgitignore/.git/**",
  ]);
});

test("Get ignores (project .eleventyignore and root .gitignore, using setUseGitIgnore(false))", async (t) => {
	let $config = await getTemplateConfigInstanceCustomCallback({
		input: "test/stubs/ignore4",
		output: "test/stubs/ignore4/_site",
  }, function($config) {
    $config.setUseGitIgnore(false);
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);

  evf._setLocalPathRoot("./test/stubs/ignorelocalrootgitignore");

  t.deepEqual(evf.getIgnores(), [
    "./test/stubs/ignorelocalrootgitignore/test.md",
    "./test/stubs/ignore4/ignoredFolder/**",
    "./test/stubs/ignore4/ignoredFolder/ignored.md",
    "./test/stubs/ignore4/_site/**",
  ]);

  t.deepEqual(evf.getIgnoreGlobs().slice(-2), [
    "**/node_modules/**",
    "./test/stubs/ignorelocalrootgitignore/.git/**",
  ]);
});

test("Get ignores (no .eleventyignore  .gitignore exists but empty)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/ignore5",
      output: "test/stubs/ignore5/_site"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);

  evf._setLocalPathRoot("./test/stubs/ignorelocalroot");

  t.deepEqual(evf.getIgnores(), [
    "./test/stubs/ignorelocalroot/test.md",
    "./test/stubs/ignore5/_site/**",
  ]);

  t.deepEqual(evf.getIgnoreGlobs().slice(-2), [
    "**/node_modules/**",
    "./test/stubs/ignorelocalroot/.git/**",
  ]);
});

test("Get ignores (both .eleventyignore and .gitignore exists, but .gitignore is empty)", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/ignore6",
      output: "test/stubs/ignore6/_site"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);
  evf._setLocalPathRoot("./test/stubs/ignorelocalroot");

  t.deepEqual(evf.getIgnores(), [
    "./test/stubs/ignorelocalroot/test.md",
    "./test/stubs/ignore6/ignoredFolder/**",
    "./test/stubs/ignore6/ignoredFolder/ignored.md",
    "./test/stubs/ignore6/_site/**",
  ]);

  t.deepEqual(evf.getIgnoreGlobs().slice(-2), [
    "**/node_modules/**",
    "./test/stubs/ignorelocalroot/.git/**",
  ]);
});

test("Bad expected output, this indicates a bug upstream in a dependency (update, was fixed in fast-glob@3.3.3).  Input to 'src' and empty includes dir (issue #403, full paths in eleventyignore)", async (t) => {
	let $config = await getTemplateConfigInstanceCustomCallback({
		input: "test/stubs-403",
		output: "_site",
		includes: "",
		data: false,
  }, function($config) {
    $config.setUseGitIgnore(false);
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid"], $config);
  evf._setEleventyIgnoreContent(TemplatePath.absolutePath("test/stubs-403/_includes") + "/**");
  evf.init(); // duplicate init

  t.deepEqual(await evf.getFiles(), [
    "./test/stubs-403/template.liquid",
    // UPDATE: this was fixed in fast-glob@3.3.3
    // This should be excluded from this list but is not because the ignore content used an absolutePath above.
    // "./test/stubs-403/_includes/include.liquid",
  ]);
});

test("Workaround for Bad expected output, this indicates a bug upstream in a dependency.  Input to 'src' and empty includes dir (issue #403, full paths in eleventyignore)", async (t) => {
	let $config = await getTemplateConfigInstanceCustomCallback({
		input: "test/stubs-403",
		output: "_site",
		includes: "",
		data: false,
  }, function($config) {
    $config.setUseGitIgnore(false);
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid"], $config);
  evf._setEleventyIgnoreContent("./test/stubs-403/_includes/**");
  evf.init(); // duplicate init

  t.deepEqual(await evf.getFiles(), ["./test/stubs-403/template.liquid"]);
});

test("Issue #403: all .eleventyignores should be relative paths not absolute paths", async (t) => {
	let $config = await getTemplateConfigInstanceCustomCallback({
		input: "test/stubs-403",
		output: "_site",
		includes: "",
		data: false,
  }, function($config) {
    $config.setUseGitIgnore(false);
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["liquid"], $config);

  let globs = await evf.getFileGlobs();
  t.is(
    globs.filter((glob) => {
      return glob.indexOf(TemplatePath.absolutePath()) > -1;
    }).length,
    0
  );
});

test("Same input and output directories, issues #186 and #1129", async (t) => {
	let $config = await getTemplateConfigInstanceCustomCallback({
		input: "test/stubs",
		output: "",
  }, function($config) {
    $config.setUseGitIgnore(false);
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);

  t.deepEqual(
    evf.getIgnores().filter((entry) => entry.indexOf("_site") > -1),
    []
  );
});

test("Single input file is in the output directory, issues #186", async (t) => {
  let $config = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "",
    includes: "",
  }, function($config) {
    $config.setUseGitIgnore(false);
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance(["njk"], $config);

  t.deepEqual(
    evf.getIgnores().filter((entry) => entry.indexOf("_site") > -1),
    []
  );
});

test("De-duplicated ignores", async (t) => {
  let $config = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/ignore-dedupe",
      output: "test/stubs/ignore-dedupe/_site"
    }
  });

  let { eleventyFiles: evf } = getEleventyFilesInstance([], $config);

  evf._setLocalPathRoot("./test/stubs/ignore-dedupe");

  t.deepEqual(evf.getGlobWatcherFiles(), [
    "./test/stubs/ignore-dedupe/_includes/**",
    "./test/stubs/ignore-dedupe/_data/**",
  ]);

  t.deepEqual(evf.getIgnores(), [
    "./test/stubs/ignore-dedupe/ignoredFolder",
    "./test/stubs/ignore-dedupe/_site/**",
  ]);

  t.deepEqual(evf.getIgnoreGlobs().slice(-2), [
    "**/node_modules/**",
    "./test/stubs/ignore-dedupe/.git/**",
  ]);
});
