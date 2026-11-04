import test from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Serve from "../src/Serve.js";
import Core from "../src/Core.js";
import TemplateConfig from "../src/TemplateConfig.js";
import ConsoleLogger from "../src/Util/ConsoleLogger.js";
import { deleteDirectory } from "./_testHelpers.js";

async function getServerInstance(eleventyConfig) {
  let es = new Serve();
  if (!eleventyConfig) {
    eleventyConfig = new TemplateConfig();
    await eleventyConfig.init();
  }

  es.eleventyConfig = eleventyConfig;
  es.logger = new ConsoleLogger();

  await es.init();

  delete es.options.logger;
  delete es.options.module;

  return es;
}

test("Constructor", async (t) => {
  let es = await getServerInstance();
  t.assert.strictEqual(es.options.pathPrefix, "/");
});

test("Get Options", async (t) => {
  let es = await getServerInstance();
  es.setOutputDir("_site");

  t.assert.deepStrictEqual(es.options, {
    pathPrefix: "/",
    port: 8080,
  });
});

test("Get Options (with a pathPrefix)", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init({ pathPrefix: "/web/" });

  let es = await getServerInstance(eleventyConfig);
  es.setOutputDir("_site");

  t.assert.deepStrictEqual(es.options, {
    pathPrefix: "/web/",
    port: 8080,
  });
});

test("Get Options (override in config)", async (t) => {
  let es = await getServerInstance();
  es.setOutputDir("_site");

  t.assert.deepStrictEqual(es.options, {
    pathPrefix: "/",
    port: 8080,
  });
});

test("Sanity test that default output is set correctly", async (t) => {
  let es = await getServerInstance();
  es.setOutputDir("_site");
  await es.initServerInstance();

  t.assert.strictEqual(es.server.dir, "_site");
});

// This assert should work once updating the output dir of the server works.
test("Custom output dir is set correctly", async (t) => {
  let es = await getServerInstance();
  es.setOutputDir("x");
  await es.initServerInstance();

  t.assert.strictEqual(es.outputDir, "x");

  t.assert.strictEqual(es.server.dir, "x");
});

test("Incremental passthrough builds merge into existing dev server entries", async (t) => {
  let outputDir = path.join(mkdtempSync(path.join(tmpdir(), "serve-incremental-")), "_site");
  let core = new Core("test/stubs/template-passthrough", outputDir, {
    runMode: "serve",
    quietMode: true,
    configPath: false,
    config(eleventyConfig) {
      eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
      eleventyConfig.addPassthroughCopy({ "test/stubs/template-passthrough/static": "static" });
      eleventyConfig.addPassthroughCopy({ "test/stubs/template-passthrough/img.jpg": "img.jpg" });
    },
  });
  core.disableLogger();
  await core.init();

  let entries;
  core.eleventyServe._server = {
    setPassthroughCopies(e) {
      entries = e;
    },
  };

  await core.write();
  t.assert.deepStrictEqual(entries.map(({ url }) => url).sort(), ["/img.jpg", "/static"]);

  core.setIncrementalFile("./test/stubs/template-passthrough/img.jpg");
  await core.write();
  t.assert.deepStrictEqual(entries.map(({ url }) => url).sort(), ["/img.jpg", "/static"]);
});

test("Emulated passthrough entries reach the dev server before templates finish rendering", async (t) => {
  let outputDir = path.join(mkdtempSync(path.join(tmpdir(), "serve-early-")), "_site");
  let entries;
  let entriesDuringRender;
  let core = new Core("test/stubs/template-passthrough", outputDir, {
    runMode: "serve",
    quietMode: true,
    configPath: false,
    config(eleventyConfig) {
      eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
      eleventyConfig.addPassthroughCopy({ "test/stubs/template-passthrough/static": "static" });
      eleventyConfig.addTemplate("index.html", "Hello");
      eleventyConfig.addTransform("wait-for-entries", async (content) => {
        for (let j = 0; j < 50 && !entries; j++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        entriesDuringRender ??= entries;
        return content;
      });
    },
  });
  core.disableLogger();
  await core.init();

  core.eleventyServe._server = {
    setPassthroughCopies(e) {
      entries = e;
    },
  };

  await core.write();
  t.assert.deepStrictEqual(entriesDuringRender?.map(({ url }) => url), ["/static"]);
});

test("Emulated passthrough copy files added or deleted after the build update the dev server (#3007)", async (t) => {
  let inputDir = "test/stubs-3007";
  deleteDirectory(inputDir);
  mkdirSync(inputDir);
  t.after(() => deleteDirectory(inputDir));

  let core = new Core(inputDir, mkdtempSync(path.join(tmpdir(), "serve-3007-")), {
    runMode: "serve",
    quietMode: true,
    configPath: false,
    config(eleventyConfig) {
      eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
      eleventyConfig.addPassthroughCopy({ "test/stubs-3007/_tmp/styles.css": "assets/styles.css" });
      eleventyConfig.addTemplate("index.html", "Hello");
    },
  });
  core.disableLogger();
  await core.init();
  await core.write();

  // Events are emitted manually below
  core.eleventyServe.resetConfig();
  await core.eleventyServe.initServerInstance();
  let watcher = core.eleventyServe.options.chokidar;
  t.after(() => watcher.close());

  let entries;
  core.eleventyServe._server.setPassthroughCopies = (e) => {
    entries = e;
  };

  mkdirSync(`${inputDir}/_tmp`);
  writeFileSync(`${inputDir}/_tmp/styles.css`, "body {}");
  watcher.emit("add", `${inputDir}/_tmp/styles.css`);
  await new Promise((resolve) => setTimeout(resolve, 50));

  t.assert.deepStrictEqual(entries?.map(({ url, inputPath }) => [url, inputPath]), [["/assets/styles.css", "./test/stubs-3007/_tmp/styles.css"]]);

  watcher.emit("unlink", `${inputDir}/_tmp/styles.css`);
  t.assert.deepStrictEqual(entries, []);
});

test("sendBuildStart is a no-op without a server or when the server doesn’t implement it", async (t) => {
  let es = new Serve();
  await t.assert.doesNotReject(() => es.sendBuildStart());

  es._server = {};
  await t.assert.doesNotReject(() => es.sendBuildStart());

  let calls = 0;
  es._server = {
    sendBuildStart() {
      calls++;
    },
  };
  await es.sendBuildStart();
  t.assert.strictEqual(calls, 1);
});

async function getWatchCore(configCallback) {
  let core = new Core(mkdtempSync(path.join(tmpdir(), "eleventy-input-")), mkdtempSync(path.join(tmpdir(), "eleventy-output-")), {
    runMode: "serve",
    quietMode: true,
    configPath: false,
    config: configCallback,
  });
  core.disableLogger();
  await core.init();

  let calls = [];
  core.eleventyServe._server = {
    sendBuildStart() {
      calls.push("sendBuildStart");
    },
    reload() {
      calls.push("reload");
    },
    sendError() {
      calls.push("sendError");
    },
  };
  // Skip chokidar and the options-changed restart (`serve()` was never called)
  core.startWatch = async () => {};
  core.eleventyServe.hasOptionsChanged = () => false;

  return { core, calls };
}

test("Initial watch build signals build start, then reloads", async (t) => {
  let { core, calls } = await getWatchCore((eleventyConfig) => {
    eleventyConfig.addTemplate("index.html", "Hello");
  });

  await core.watch();
  t.assert.deepStrictEqual(calls, ["sendBuildStart", "reload"]);
});

test("Failed initial watch build sends an error and still starts the watcher", async (t) => {
  let { core, calls } = await getWatchCore((eleventyConfig) => {
    eleventyConfig.addTemplate("index.html", "Hello");
    eleventyConfig.addTransform("fail", () => {
      throw new Error("Broken");
    });
  });
  core.startWatch = async () => {
    calls.push("startWatch");
  };

  let exitCode = process.exitCode;
  await core.watch();
  process.exitCode = exitCode;

  t.assert.deepStrictEqual(calls, ["sendBuildStart", "sendError", "startWatch"]);
});
