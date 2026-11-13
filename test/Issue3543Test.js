import test from "node:test";
import chokidar from "@11ty/chokidar-with-glob-support";

import { getTemplateConfigInstanceCustomCallback, getEleventyFilesInstance } from "./_testHelpers.js";

function mockStats(isDirectory) {
  return {
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
  };
}

async function getFiles() {
  let templateConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs-3543",
    output: "test/stubs-3543/_site",
  }, function($config) {
    $config.addPassthroughCopy("test/stubs-3543/**/*.css");
    $config.ignores.add("test/stubs-3543/drafts/**");
  });

  let { eleventyFiles } = getEleventyFilesInstance(["md"], templateConfig);
  eleventyFiles._setEleventyIgnoreContent("./test/stubs-3543/assets/**");
  eleventyFiles.init();
  return eleventyFiles;
}

// Mirrors the chokidar `ignored` callback for a watcher with these targets and ignores
function getIsIgnored(targets, ignored) {
  let watchTargets = new chokidar.WatchTargets({ ignored, nocase: true });
  watchTargets.add(targets);
  return (path, isDirectory) => watchTargets.isIgnored(path, mockStats(isDirectory));
}

test("#3543 Watcher ignores split into always-ignored and project ignores", async (t) => {
  let files = await getFiles();

  let ignores = files.getGlobWatcherIgnores();
  t.assert.ok(ignores.includes("test/stubs-3543/_site/**"));
  t.assert.ok(ignores.includes("**/node_modules/**"));
  t.assert.ok(!ignores.includes("test/stubs-3543/assets/**"));

  let projectIgnores = files.getGlobWatcherProjectIgnores();
  t.assert.ok(projectIgnores.includes("test/stubs-3543/assets/**"));
  // `$config.ignores` applies to the watcher like `.eleventyignore`
  t.assert.ok(projectIgnores.includes("./test/stubs-3543/drafts/**"));
});

test("#3543 `addPassthroughCopy` sources are watched separately", async (t) => {
  let files = await getFiles();

  t.assert.ok(!files.getGlobWatcherFiles().includes("./test/stubs-3543/**/*.css"));
  t.assert.deepStrictEqual(files.getGlobWatcherFilesForCopiedPassthroughCopy(), [
    "./test/stubs-3543/**/*.css",
  ]);
});

test("#3543 Project ignores don’t apply to the passthrough copy watcher", async (t) => {
  let files = await getFiles();
  let ignores = files.getGlobWatcherIgnores();

  let isIgnoredByBuildWatcher = getIsIgnored(files.getGlobWatcherFiles(), [
    ...ignores,
    ...files.getGlobWatcherProjectIgnores(),
  ]);
  t.assert.strictEqual(isIgnoredByBuildWatcher("test/stubs-3543/index.md", false), false);
  t.assert.strictEqual(isIgnoredByBuildWatcher("test/stubs-3543/assets/notes.md", false), true);
  t.assert.strictEqual(isIgnoredByBuildWatcher("test/stubs-3543/drafts/post.md", false), true);

  let isIgnoredByPassthroughWatcher = getIsIgnored(
    files.getGlobWatcherFilesForCopiedPassthroughCopy(),
    ignores,
  );
  t.assert.strictEqual(isIgnoredByPassthroughWatcher("test/stubs-3543/assets", true), false);
  t.assert.strictEqual(isIgnoredByPassthroughWatcher("test/stubs-3543/assets/main.css", false), false);
  t.assert.strictEqual(isIgnoredByPassthroughWatcher("test/stubs-3543/drafts/style.css", false), false);
  t.assert.strictEqual(isIgnoredByPassthroughWatcher("test/stubs-3543/_site/main.css", false), true);
  t.assert.strictEqual(isIgnoredByPassthroughWatcher("test/stubs-3543/node_modules/pkg/main.css", false), true);
});
