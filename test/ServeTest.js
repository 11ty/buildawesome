import test from "ava";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Serve from "../src/Serve.js";
import Core from "../src/Core.js";
import TemplateConfig from "../src/TemplateConfig.js";
import ConsoleLogger from "../src/Util/ConsoleLogger.js";

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
  t.is(es.options.pathPrefix, "/");
});

test("Get Options", async (t) => {
  let es = await getServerInstance();
  es.setOutputDir("_site");

  t.deepEqual(es.options, {
    onClientMessage: async() => {},
    pathPrefix: "/",
    port: 8080,
  });
});

test("Get Options (with a pathPrefix)", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init({ pathPrefix: "/web/" });

  let es = await getServerInstance(eleventyConfig);
  es.setOutputDir("_site");

  t.deepEqual(es.options, {
    onClientMessage: async() => {},
    pathPrefix: "/web/",
    port: 8080,
  });
});

test("Get Options (override in config)", async (t) => {
  let es = await getServerInstance();
  es.setOutputDir("_site");

  t.deepEqual(es.options, {
    onClientMessage: async() => {},
    pathPrefix: "/",
    port: 8080,
  });
});

test("Sanity test that default output is set correctly", async (t) => {
  let es = await getServerInstance();
  es.setOutputDir("_site");
  await es.initServerInstance();

  t.is(es.server.dir, "_site");
});

// This assert should work once updating the output dir of the server works.
test("Custom output dir is set correctly", async (t) => {
  let es = await getServerInstance();
  es.setOutputDir("x");
  await es.initServerInstance();

  t.is(es.outputDir, "x");

  t.is(es.server.dir, "x");
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
  t.deepEqual(entries.map(({ url }) => url).sort(), ["/img.jpg", "/static"]);

  core.setIncrementalFile("./test/stubs/template-passthrough/img.jpg");
  await core.write();
  t.deepEqual(entries.map(({ url }) => url).sort(), ["/img.jpg", "/static"]);
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
  t.deepEqual(entriesDuringRender?.map(({ url }) => url), ["/static"]);
});
