import test from "ava";
import fs from "node:fs";
import path from "node:path";
import lodash from "@11ty/lodash-custom";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { marked } from "marked";
import nunjucks from "@11ty/nunjucks";
import * as sass from "sass";

import Eleventy, { HtmlBasePlugin } from "../src/Core.js";
import TemplateContent from "../src/TemplateContent.js";
import TemplateMap from "../src/TemplateMap.js";
import TemplateConfig from "../src/TemplateConfig.js";
import { getCreatedTimestamp, getUpdatedTimestamp } from "../src/Util/Git.js";
import PathNormalizer from "../src/Util/PathNormalizer.js";
import { normalizeNewLines, localizeNewLines } from "./Util/normalizeNewLines.js";
import { isTypeScriptSupported } from "../src/Util/TypeScriptFeatureTest.cjs";
import { deleteDirectory } from "./_testHelpers.js";

const lodashGet = lodash.get;

test("Eleventy, defaults inherit from config", async (t) => {
  let elev = new Eleventy();

  let $config = new TemplateConfig();
  await $config.init();

  await elev.initializeConfig();
  let config = $config.getConfig();

  t.truthy(elev.input);
  t.truthy(elev.outputDir);
  t.is(config.dir.input, ".");
  t.is(elev.input, "./");
  t.is(config.dir.output, "_site");
  t.is(elev.outputDir, "./_site/");
});

test("Eleventy, null output directory should default to _site", async (t) => {
  let elev = new Eleventy(".", null);

  let $config = new TemplateConfig();
  await $config.init();

  await elev.initializeConfig();
  let config = $config.getConfig();

  t.is(config.dir.input, ".");
  t.is(elev.input, "./");
  t.is(config.dir.output, "_site");
  t.is(elev.outputDir, "./_site/");
});

test("Eleventy, get version", (t) => {
  let elev = new Eleventy();

  t.truthy(elev.getVersion());
});

test("Eleventy, get help", (t) => {
  let elev = new Eleventy();

  t.truthy(elev.getHelp());
});

test("Eleventy, set is verbose (before config init)", async (t) => {
  let elev = new Eleventy();
  elev.setIsVerbose(true);

  await elev.initializeConfig();

  t.true(elev.verboseMode);
});

test("Eleventy, set is verbose (after config init)", async (t) => {
  let elev = new Eleventy();

  await elev.initializeConfig();
  elev.setIsVerbose(true);

  t.true(elev.verboseMode);
});

test("Eleventy set input/output", async (t) => {
  let elev = new Eleventy("./test/stubs", "./test/stubs/_site");

  t.is(elev.input, "./test/stubs/");
  t.is(elev.outputDir, "./test/stubs/_site/");

  await elev.init();
  t.truthy(elev.templateData);
  t.truthy(elev.writer);
});

test("process.env.ELEVENTY_*", async (t) => {
  delete process.env.ELEVENTY_ROOT;
  t.falsy(process.env.ELEVENTY_ROOT);

  let elev = new Eleventy("./test/stubs", "./test/stubs/_site");
  await elev.init();
  t.truthy(process.env.ELEVENTY_ROOT);

  // all ELEVENTY_ env variables are also available on eleventy.env
  let globals = await elev.templateData.getInitialGlobalData();
  t.truthy(globals.eleventy.env.root);
});

test("process.env.BUILDAWESOME_*", async (t) => {
  delete process.env.BUILDAWESOME_ROOT;
  t.falsy(process.env.BUILDAWESOME_ROOT);

  let elev = new Eleventy("./test/stubs", "./test/stubs/_site");
  await elev.init();
  t.truthy(process.env.BUILDAWESOME_ROOT);

  // all BUILDAWESOME_ env variables are also available on eleventy.env
  let globals = await elev.templateData.getInitialGlobalData();
  t.truthy(globals.eleventy.env.root);
});

test("Eleventy file watching", async (t) => {
  let elev = new Eleventy("./test/stubs", "./test/stubs/_site", {
    runMode: "watch" // required to spider deps
  });
  elev.setFormats("njk");
  elev.disableLogger();

  await elev.init();
  let globalData = await elev.templateData.getGlobalData();

  await elev.eleventyFiles.getFiles();
  await elev.startWatch();

  let { targets, ignores } = await elev.getWatchedTargets();
  await elev.stopWatch();

  t.deepEqual(targets, [
    "./package.json",
    "./test/stubs/**/*.njk",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
    "./.gitignore",
    "./.eleventyignore",
    "./test/stubs/.eleventyignore",
    "./test/stubs/**/*.{json,data.mjs,data.cjs,data.js,data.mts,data.cts,data.ts,11tydata.mjs,11tydata.cjs,11tydata.js,11tydata.mts,11tydata.cts,11tydata.ts}",
    "./test/stubs/deps/dep1.cjs",
    "./test/stubs/deps/dep2.cjs",
  ]);

  t.true(ignores.includes("node_modules/**"));
  t.true(ignores.includes("**/node_modules/**"));
  t.true(ignores.includes("test/stubs/_site/**"));
  t.true(ignores.includes("./.git/**"));
  t.true(ignores.includes(".cache"));
});

test("Eleventy file watching (don’t watch deps of passthrough copy .js files)", async (t) => {
  let elev = new Eleventy("./test/stubs-1325", "./test/stubs-1325/_site");
  elev.setFormats("11ty.js,js");
  elev.disableLogger();

  await elev.init();
  await elev.eleventyFiles.getFiles();
  await elev.startWatch();

  let paths = await elev.eleventyFiles.getWatchPathCache();
  await elev.stopWatch();

  t.deepEqual(paths, ["./test/stubs-1325/test.11ty.js"]);
});

test("Eleventy file watching (no JS dependencies)", async (t) => {
  let elev = new Eleventy("./test/stubs", "./test/stubs/_site", {
    config: $config => {
      $config.setWatchJavaScriptDependencies(false);
    }
  });
  elev.setFormats("njk");
  elev.disableLogger();

  await elev.init();
  await elev.startWatch();

  let { targets, ignores } = await elev.getWatchedTargets();

  await elev.stopWatch();

  t.deepEqual(targets, [
    "./package.json",
    "./test/stubs/**/*.njk",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
    "./.gitignore",
    "./.eleventyignore",
    "./test/stubs/.eleventyignore",
    `./test/stubs/**/*.{json,data.mjs,data.cjs,data.js,data.mts,data.cts,data.ts,11tydata.mjs,11tydata.cjs,11tydata.js,11tydata.mts,11tydata.cts,11tydata.ts}`,
  ]);

  t.true(ignores.includes("node_modules/**"));
  t.true(ignores.includes("**/node_modules/**"));
  t.true(ignores.includes("test/stubs/_site/**"));
  t.true(ignores.includes("./.git/**"));
  t.true(ignores.includes(".cache"));
});

test("Eleventy set input/output, one file input", async (t) => {
  let elev = new Eleventy("./test/stubs/index.html", "./test/stubs/_site");

  t.is(elev.input, "./test/stubs/index.html");
  t.is(elev.inputFile, "./test/stubs/index.html");
  t.is(elev.inputDir, "./test/stubs/");
  t.is(elev.outputDir, "./test/stubs/_site/");
});

test("Eleventy set input/output, one file input, deeper subdirectory", async (t) => {
  let elev = new Eleventy("./test/stubs/subdir/index.html", "./test/stubs/_site", {
		inputDir: "./test/stubs"
	});

  t.is(elev.input, "./test/stubs/subdir/index.html");
  t.is(elev.inputFile, "./test/stubs/subdir/index.html");
  t.is(elev.inputDir, "./test/stubs/");
  t.is(elev.outputDir, "./test/stubs/_site/");
});

test("Eleventy set input/output, one file input root dir", async (t) => {
  let elev = new Eleventy("./README.md", "./test/stubs/_site");

  t.is(elev.input, "./README.md");
  t.is(elev.inputFile, "./README.md");
  t.is(elev.inputDir, "./");
  t.is(elev.outputDir, "./test/stubs/_site/");
});

test("Eleventy set input/output, one file input root dir without leading dot/slash", async (t) => {
  let elev = new Eleventy("README.md", "./test/stubs/_site");

  t.is(elev.input, "./README.md");
  t.is(elev.inputDir, "./");
  t.is(elev.outputDir, "./test/stubs/_site/");
});

test("Eleventy set input/output, one file input exitCode (script)", async (t) => {
  let previousExitCode = process.exitCode;
  let elev = new Eleventy("./test/stubs/exitCode/failure.njk", "./test/stubs/exitCode/_site", {
    source: "script",
  });
  elev.disableLogger();

  await t.throwsAsync(async () => {
    await elev.write();
  });

  // no change to the exit code when running script
  t.is(process.exitCode, previousExitCode);
});

test("Eleventy set input/output, one file input exitCode (cli)", async (t) => {
  let previousExitCode = process.exitCode;
  let elev = new Eleventy("./test/stubs/exitCode/failure.njk", "./test/stubs/exitCode/_site", {
    source: "cli",
  });
  elev.disableLogger();

  let e = await t.throwsAsync(() => elev.write());

  t.is(e.message, "Having trouble rendering njk template ./test/stubs/exitCode/failure.njk");

  t.is(process.exitCode, 1);

  process.exitCode = previousExitCode;
});

test("Eleventy to json", async (t) => {
  let elev = new Eleventy("./test/stubs--to/");
  elev.setIsVerbose(false);

  let result = await elev.toJSON();

  t.deepEqual(
    result.filter((entry) => entry.url === "/test/"),
    [
      {
        url: "/test/",
        inputPath: "./test/stubs--to/test.md",
        outputPath: "./_site/test/index.html",
        rawInput: localizeNewLines("# hi\n"),
        content: "<h1>hi</h1>\n",
      },
    ]
  );
  t.deepEqual(
    result.filter((entry) => entry.url === "/test2/"),
    [
      {
        url: "/test2/",
        inputPath: "./test/stubs--to/test2.liquid",
        outputPath: "./_site/test2/index.html",
        rawInput: "{{ hi }}",
        content: "hello",
      },
    ]
  );
});

test("Two Eleventies, two configs!!! (config used to be a global)", async (t) => {
  let elev1 = new Eleventy();
  await elev1.initializeConfig();

  t.is(elev1.eleventyConfig, elev1.eleventyConfig);
  t.is(elev1.config, elev1.config);
  delete elev1.config.uses;
  t.is(JSON.stringify(elev1.config), JSON.stringify(elev1.config));

  let elev2 = new Eleventy();
  await elev2.initializeConfig();
  t.not(elev1.eleventyConfig, elev2.eleventyConfig);
  elev1.config.benchmarkManager = null;
  elev2.config.benchmarkManager = null;
  delete elev2.config.uses;
  t.is(JSON.stringify(elev1.config), JSON.stringify(elev2.config));
});

test("Config propagates to other instances correctly", async (t) => {
  let elev = new Eleventy();
  await elev.init();

  t.is(elev.eleventyServe.config, elev.config);

  t.is(elev.extensionMap.templateConfig, elev.eleventyConfig);
  t.is(elev.passthroughManager.templateConfig, elev.eleventyConfig);
  t.is(elev.eleventyFiles.templateConfig, elev.eleventyConfig);
  t.is(elev.templateData.templateConfig, elev.eleventyConfig);
  t.is(elev.writer.templateConfig, elev.eleventyConfig);
});

test("Eleventy programmatic API without init", async (t) => {
  let elev = new Eleventy("./test/stubs--to/");
  elev.setIsVerbose(false);

  let result = await elev.toJSON();

  t.deepEqual(
    result.filter((entry) => entry.url === "/test/"),
    [
      {
        url: "/test/",
        inputPath: "./test/stubs--to/test.md",
        outputPath: "./_site/test/index.html",
        rawInput: localizeNewLines("# hi\n"),
        content: "<h1>hi</h1>\n",
      },
    ]
  );
  t.deepEqual(
    result.filter((entry) => entry.url === "/test2/"),
    [
      {
        url: "/test2/",
        inputPath: "./test/stubs--to/test2.liquid",
        outputPath: "./_site/test2/index.html",
        rawInput: `{{ hi }}`,
        content: "hello",
      },
    ]
  );
});

test("Can Eleventy run two executeBuilds in parallel?", async (t) => {
  let elev = new Eleventy("./test/stubs--to/");
  elev.setIsVerbose(false);

  let p1 = elev.toJSON();
  let p2 = elev.toJSON();
  let [result1, result2] = await Promise.all([p1, p2]);

  let test1Result = [
    {
      url: "/test/",
      inputPath: "./test/stubs--to/test.md",
      outputPath: "./_site/test/index.html",
      rawInput: localizeNewLines("# hi\n"),
      content: "<h1>hi</h1>\n",
    },
  ];

  let test2Result = [
    {
      url: "/test2/",
      inputPath: "./test/stubs--to/test2.liquid",
      outputPath: "./_site/test2/index.html",
      rawInput: "{{ hi }}",
      content: "hello",
    },
  ];

  t.deepEqual(
    result1.filter((entry) => entry.url === "/test/"),
    test1Result
  );
  t.deepEqual(
    result1.filter((entry) => entry.url === "/test2/"),
    test2Result
  );

  t.deepEqual(
    result2.filter((entry) => entry.url === "/test/"),
    test1Result
  );
  t.deepEqual(
    result2.filter((entry) => entry.url === "/test2/"),
    test2Result
  );
});

test("Unicode in front matter `tags`, issue #670", async (t) => {
  let elev = new Eleventy("./test/stubs-670/", "./test/stubs-670/_site");

  let results = await elev.toJSON();
  results.sort((a, b) => {
    if (a.inputPath > b.inputPath) {
      return -1;
    }
    return 1;
  });

  t.is(results[0].content.trim(), "2,Cañon City,all,");
});

test("#142: date 'git Last Modified' populates page.date", async (t) => {
  let elev = new Eleventy("./test/stubs-142/", "./test/stubs-142/_site");

  let results = await elev.toJSON();
  let [result] = results;

  // Warning: this doesn’t test the validity of the function, only that it populates page.date.
  let timestamp = await getUpdatedTimestamp("./test/stubs-142/index.njk");
  t.truthy(result.content.trim());
  t.truthy(timestamp);
  t.is(result.content.trim(), "" + timestamp);
});

test("git getUpdatedTimestamp returns undefined on nonexistent path", async (t) => {
  t.is(await getUpdatedTimestamp("./test/invalid.invalid"), undefined);
});

test("#2167: Pagination with permalink: false", async (t) => {
  let elev = new Eleventy("./test/stubs-2167/", "./test/stubs-2167/_site");
  elev.disableLogger();
  elev.setDryRun(true);

  let [,pages] = await elev.write();
  t.is(pages.length, 0);

  let results = await elev.toJSON();
  t.is(results.length, 5);
});

test("Pagination over collection using eleventyComputed (liquid)", async (t) => {
  t.plan(5);
  let elev = new Eleventy(
    "./test/stubs-pagination-computed-quotes/",
    "./test/stubs-pagination-computed-quotes/_site",
    {
      config: function ($config) {
        $config.addFilter("selectRandomFromArray", (arr) => {
          t.true(Array.isArray(arr));
          t.deepEqual(arr, ["The person that shared this is awesome"]);
          return arr[0];
        });
      },
    }
  );

  let results = await elev.toJSON();
  t.is(results.length, 2);
  let content = results.map((entry) => entry.content).sort();
  t.is(content[0], "No");
  t.is(content[1], "The person that shared this is awesome");
});

test("Pagination over collection using eleventyComputed (njk)", async (t) => {
  t.plan(5);
  let elev = new Eleventy(
    "./test/stubs-pagination-computed-quotes-njk/",
    "./test/stubs-pagination-computed-quotes-njk/_site",
    {
      config: function ($config) {
        $config.addFilter("selectRandomFromArray", (arr) => {
          t.true(Array.isArray(arr));
          t.deepEqual(arr, ["The person that shared this is awesome"]);
          return arr[0];
        });
      },
    }
  );

  let results = await elev.toJSON();
  t.is(results.length, 2);
  let content = results.map((entry) => entry.content).sort();
  t.is(content[0], "No");
  t.is(content[1], "The person that shared this is awesome");
});

test("Paginated template uses proxy and global data", async (t) => {
  let elev = new Eleventy(
    "./test/proxy-pagination-globaldata/",
    "./test/proxy-pagination-globaldata/_site",
    {
      config: function ($config) {},
    }
  );

  let results = await elev.toJSON();
  let allContentMatches = results.filter((entry) => {
    return entry.content.trim() === "BANNER TEXT";
  });
  t.is(results.length, allContentMatches.length);
});

test("Liquid shortcode with multiple arguments(issue #2348)", async (t) => {
  // NOTE issue #2348 was only active when you were processing multiple templates at the same time.

  let elev = new Eleventy("./test/stubs-2367/", "./test/stubs-2367/_site", {
    config: function ($config) {
      $config.addShortcode("simplelink", function (...args) {
        return JSON.stringify(args);
      });
    },
  });

  let arr = ["layout", "/mylayout", "layout", "/mylayout", "layout", "/mylayout"];
  let str = normalizeNewLines(`${JSON.stringify(arr)}
${JSON.stringify(arr)}`);
  let results = await elev.toJSON();
  t.is(results.length, 2);
  let content = results.map((entry) => entry.content).sort();
  t.is(normalizeNewLines(content[0]), str);
  t.is(normalizeNewLines(content[1]), str);
});

test("#2224: date 'git created' populates page.date", async (t) => {
  let elev = new Eleventy("./test/stubs-2224/", "./test/stubs-2224/_site");

  let results = await elev.toJSON();
  let [result] = results;

  // This doesn’t test the validity of the function, only that it populates page.date.
  let timestamp = await getCreatedTimestamp("./test/stubs-2224/index.njk");
  t.truthy(result.content.trim());
  t.truthy(timestamp);
  t.is(result.content.trim(), "" + timestamp);
});

test("git getCreatedTimestamp returns undefined on nonexistent path", async (t) => {
  t.is(await getCreatedTimestamp("./test/invalid.invalid"), undefined);
});

test("Does pathPrefix affect page URLs", async (t) => {
  let elev = new Eleventy("./README.md", "./_site", {
    config: function ($config) {
      return {
        pathPrefix: "/testdirectory/",
      };
    },
  });

  let results = await elev.toJSON();
  let [result] = results;
  t.is(result.url, "/README/");
});

test("Improvements to custom template syntax APIs (includes a layout file) #2258", async (t) => {
  let elev = new Eleventy("./test/stubs-2258/", "./test/stubs-2258/_site", {
    configPath: "./test/stubs-2258/eleventy.config.cjs",
  });

  // Restore previous contents
  let includeFilePath = "./test/stubs-2258/_includes/_code.scss";
  let previousContents = `code {
  padding: 0.25em;
  line-height: 0;
}`;
  let newContents = `/* New content */`;

  fs.writeFileSync(includeFilePath, previousContents, "utf8");

  let sizes = [TemplateContent._inputCache.size, TemplateContent._compileCache.size];

  let results = await elev.toJSON();

  t.is(results.length, 1);
  t.is(
    normalizeNewLines(results[0].content),
    `/* Banner */
${previousContents}

/* Comment */`
  );

  // Cache sizes are now one bigger
  t.is(sizes[0] + 1, 1);
  t.is(sizes[1] + 1, 1);

  let results2 = await elev.toJSON();
  t.is(
    normalizeNewLines(results2[0].content),
    `/* Banner */
${previousContents}

/* Comment */`
  );

  // Cache sizes are unchanged from last build
  t.is(sizes[0] + 1, 1);
  t.is(sizes[1] + 1, 1);

  fs.writeFileSync(includeFilePath, newContents, "utf8");

  // This also triggers that the file has changed in the event bus via setPreviousBuildModifiedFile
  elev.setIncrementalFiles(includeFilePath);

  let results3 = await elev.toJSON();
  t.is(
    normalizeNewLines(results3[0].content),
    `/* Banner */
${newContents}
/* Comment */`
  );

  fs.writeFileSync(includeFilePath, previousContents, "utf8");
});


test("`useLayouts: false` custom engine property #2830", async (t) => {
  let elev = new Eleventy("./test/stubs-2258-2830-skip-layouts/", "./test/stubs-2258-2830-skip-layouts/_site", {
    configPath: "./test/stubs-2258-2830-skip-layouts/eleventy.config.cjs",
  });

  let results = await elev.toJSON();

  t.is(results.length, 1);
  t.is(
    normalizeNewLines(results[0].content),
    `code {
  padding: 0.25em;
  line-height: 0;
}`
  );
});

test("Lodash get (for pagination data target) object key with spaces, issue #2851", (t) => {
  let data = {
    collections: {
      "tag with spaces": 2,
    },
  };
  t.is(2, lodashGet(data, "collections['tag with spaces']"));

  // wow, this works huh?
  t.is(2, lodashGet(data, "collections.tag with spaces"));

  let tm = new TemplateMap(new TemplateConfig());
  t.is(tm.getTagTarget("collections.tag with spaces"), "tag with spaces");
  t.is(tm.getTagTarget("collections['tag with spaces']"), "tag with spaces");
  t.is(tm.getTagTarget('collections["tag with spaces"]'), "tag with spaces");
});

test("Eleventy tag collection with spaces in the tag name, issue #2851", async (t) => {
  let elev = new Eleventy("./test/stubs-2851", "./test/stubs-2851/_site", {
    config: function ($config) {
      $config.dataFilterSelectors.add("collections");
    },
  });
  elev.setIsVerbose(false);

  let result = await elev.toJSON();
  t.deepEqual(result.length, 2);
  t.deepEqual(result.length, result[0].data.collections.all.length);
  t.deepEqual(result[0].data.collections["tag with spaces"].length, 1);
});

test("this.eleventy on JavaScript template functions, issue #2790", async (t) => {
  t.plan(3);

  let elev = new Eleventy("./test/stubs-2790", "./test/stubs-2790/_site", {
    config: function ($config) {
      $config.addJavaScriptFunction("jsfunction", function () {
        t.truthy(this.eleventy);
        return this.eleventy.generator.split(" ")[0];
      });
    },
  });
  let result = await elev.toJSON();
  t.deepEqual(result.length, 1);
  t.deepEqual(result[0].content, `<p>Eleventy</p>`);
});

test("Global data JS files should only execute once, issue #2753", async (t) => {
  let elev = new Eleventy("./test/stubs-2753", "./test/stubs-2753/_site", {
    config: function ($config) {},
  });
  let result = await elev.toJSON();
  t.deepEqual(result.length, 2);
  t.deepEqual(result[0].content, `1`);
  t.deepEqual(result[0].content, `1`);
});

function sortResultsBy(results, key = "content") {
  results.sort((a, b) => {
    if(a[key] < b[key]) {
      return -1;
    }
    if(b[key] < a[key]) {
      return 1;
    }
    return 0;
  });
}

test("Access to raw input of file (toJSON), issue #1206", async (t) => {
  let elev = new Eleventy("./test/stubs-1206", "./test/stubs-1206/_site", {
    config: function ($config) {},
  });
  let results = await elev.toJSON();
  sortResultsBy(results, "content");

  t.deepEqual(results.length, 2);
  t.deepEqual(results[0].content, `This is the first template.This is the first template.{{ page.rawInput }}`);
  t.deepEqual(results[0].rawInput, `This is the first template.{{ page.rawInput }}`);
  t.deepEqual(results[1].content, `This is the second template.This is the first template.{{ page.rawInput }}`);
  t.deepEqual(results[1].rawInput, `This is the second template.{{ collections.tag1[0].rawInput }}`);
});

// Warning: this test writes to the file system
test("Access to raw input of file (dryRun), issue #1206", async (t) => {
  let elev = new Eleventy("./test/stubs-1206", "./test/stubs-1206/_site", {
    config: function ($config) {},
  });
  elev.disableLogger();

  let [,results] = await elev.write();
  sortResultsBy(results, "content");

  t.deepEqual(results.length, 2);
  t.deepEqual(results[0].content, `This is the first template.This is the first template.{{ page.rawInput }}`);
  t.deepEqual(results[0].rawInput, `This is the first template.{{ page.rawInput }}`);
  t.deepEqual(results[1].content, `This is the second template.This is the first template.{{ page.rawInput }}`);
  t.deepEqual(results[1].rawInput, `This is the second template.{{ collections.tag1[0].rawInput }}`);

	deleteDirectory("./test/stubs-1206/_site/");
});

test("{eleventy,buildawesome}.before and {eleventy,buildawesome}.after Event Arguments, directories", async (t) => {
  t.plan(12);
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    config: function ($config) {
      $config.on("eleventy.before", arg => {
        t.is(arg.inputDir, "./test/noop/");
        t.is(arg.directories.input, "./test/noop/");
        t.is(arg.directories.includes, "./test/noop/_includes/");
      })
      $config.on("buildawesome.before", arg => {
        t.is(arg.inputDir, "./test/noop/");
        t.is(arg.directories.input, "./test/noop/");
        t.is(arg.directories.includes, "./test/noop/_includes/");
      })
      $config.on("eleventy.after", arg => {
        t.is(arg.inputDir, "./test/noop/");
        t.is(arg.directories.input, "./test/noop/");
        t.is(arg.directories.includes, "./test/noop/_includes/");
      })
      $config.on("buildawesome.after", arg => {
        t.is(arg.inputDir, "./test/noop/");
        t.is(arg.directories.input, "./test/noop/");
        t.is(arg.directories.includes, "./test/noop/_includes/");
      })
    },
  });

  let results = await elev.toJSON();
});

test("{eleventy,buildawesome}.before and {eleventy,buildawesome}.after Event Arguments, dryRun default", async (t) => {
  t.plan(4);
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    config: function ($config) {
      $config.on("eleventy.before", arg => {
        t.is(arg.dryRun, false);
      })
      $config.on("buildawesome.before", arg => {
        t.is(arg.dryRun, false);
      })
      $config.on("eleventy.after", arg => {
        t.is(arg.dryRun, false);
      })
      $config.on("buildawesome.after", arg => {
        t.is(arg.dryRun, false);
      })
    },
  });

  let results = await elev.toJSON();
});

test("{eleventy,buildawesome}.before and {eleventy,buildawesome}.after Event Arguments, dryRun enabled", async (t) => {
  t.plan(4);
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    dryRun: true,
    config: function ($config) {
      $config.on("eleventy.before", arg => {
        t.is(arg.dryRun, true);
      })
      $config.on("buildawesome.before", arg => {
        t.is(arg.dryRun, true);
      })
      $config.on("eleventy.after", arg => {
        t.is(arg.dryRun, true);
      })
      $config.on("buildawesome.after", arg => {
        t.is(arg.dryRun, true);
      })
    },
  });

  let results = await elev.toJSON();
});

test("buildawesome.after fires sequentially setting eventEmitterMode 'sequential'", async (t) => {
  let reachFirst;
  const firstReached = new Promise(resolve => reachFirst = resolve)
  let next;
  const firstResult = new Promise(resolve => next = resolve)
  let secondCalled = false;
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    config: function (configApi) {
      configApi.setEventEmitterMode('sequential')
      configApi.on("buildawesome.after", arg => {
        reachFirst()
        return firstResult;
      })
      configApi.on("buildawesome.after", arg => {
        secondCalled = true;
      })
    },
  });
  const resultPromise = elev.toJSON();
  await firstReached;
  t.is(secondCalled, false)
  next()
  await 'microtask'
  t.is(secondCalled, true)
  await resultPromise;
})

test("setInputDirectory config method #1503", async (t) => {
  t.plan(5);
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    config: function ($config) {
      $config.setInputDirectory("./test/noop2/");

      $config.on("buildawesome.before", arg => {
        t.is(arg.directories.input, "./test/noop2/");
        t.is(arg.directories.includes, "./test/noop2/_includes/");
        t.is(arg.directories.data, "./test/noop2/_data/");
        t.is(arg.directories.layouts, undefined);
        t.is(arg.directories.output, "./test/noop/_site/");
      })
    },
  });

  let results = await elev.toJSON();
});

test("setIncludesDirectory config method #1503", async (t) => {
  t.plan(5);
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    config: function ($config) {
      $config.setIncludesDirectory("myincludes");

      $config.on("buildawesome.before", arg => {
        t.is(arg.directories.input, "./test/noop/");
        t.is(arg.directories.includes, "./test/noop/myincludes/");
        t.is(arg.directories.data, "./test/noop/_data/");
        t.is(arg.directories.layouts, undefined);
        t.is(arg.directories.output, "./test/noop/_site/");
      })
    },
  });

  let results = await elev.toJSON();
});

test("setDataDirectory config method #1503", async (t) => {
  t.plan(5);
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    config: function ($config) {
      $config.setDataDirectory("data");

      $config.on("buildawesome.before", arg => {
        t.is(arg.directories.input, "./test/noop/");
        t.is(arg.directories.includes, "./test/noop/_includes/");
        t.is(arg.directories.data, "./test/noop/data/");
        t.is(arg.directories.layouts, undefined);
        t.is(arg.directories.output, "./test/noop/_site/");
      })
    },
  });

  let results = await elev.toJSON();
});

test("setLayoutsDirectory config method #1503", async (t) => {
  t.plan(5);
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    config: function ($config) {
      $config.setLayoutsDirectory("layouts");

      $config.on("buildawesome.before", arg => {
        t.is(arg.directories.input, "./test/noop/");
        t.is(arg.directories.includes, "./test/noop/_includes/");
        t.is(arg.directories.data, "./test/noop/_data/");
        t.is(arg.directories.layouts, "./test/noop/layouts/");
        t.is(arg.directories.output, "./test/noop/_site/");
      })
    },
  });

  let results = await elev.toJSON();
});

test("setInputDirectory config method #1503 in a plugin throws error", async (t) => {
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    config: function ($config) {
      $config.addPlugin(() => {
        $config.setInputDirectory("./test/noop2/");
      });
    },
  });

  await t.throwsAsync(() => elev.toJSON(), {
    // The `set*Directory` configuration API methods are not yet allowed in plugins.
    message: "Error processing a plugin",
  });
});

test("Accepts absolute paths for input and output", async (t) => {
  let input = path.resolve("./test/noop/");
  let output = path.resolve("./test/noop/_site");

  let elev = new Eleventy(input, output);

  let results = await elev.toJSON();

  // trailing slashes are expected
  t.is(PathNormalizer.normalizeSeperator(elev.directories.input), PathNormalizer.normalizeSeperator("./test/noop/"));
  t.is(PathNormalizer.normalizeSeperator(elev.directories.includes), PathNormalizer.normalizeSeperator("./test/noop/_includes/"));
  t.is(PathNormalizer.normalizeSeperator(elev.directories.data), PathNormalizer.normalizeSeperator("./test/noop/_data/"));
  t.is(elev.directories.layouts, undefined);
  t.is(PathNormalizer.normalizeSeperator(elev.directories.output), PathNormalizer.normalizeSeperator("./test/noop/_site/"));
});

test("Accepts absolute paths urls for input and output, results output #3805", async (t) => {
  let input = path.resolve("./test/stubs-absolute/test.md");
  let output = path.resolve("./test/stubs-absolute/_site");
  let elev = new Eleventy(input, output);

  let results = await elev.toJSON();
  t.is(results.length, 1);
});

test("Accepts absolute paths urls for input and output and a virtual template, results output #3805", async (t) => {
  let input = path.resolve("./test/noop/");
  let output = path.resolve("./test/noop/_site");
  let elev = new Eleventy(input, output, {
    config: $config => {
      $config.addTemplate("index.md", `# Title`)
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
});

test("Eleventy config export (ESM)", async (t) => {
  t.plan(5);
  let elev = new Eleventy("test/stubs/cfg-directories-export", null, {
    configPath: "./test/stubs/cfg-directories-export/eleventy.config.js",
    config: function (configApi) {
      configApi.on("buildawesome.after", arg => {
        t.is(arg.directories.input, "./src/");
        t.is(arg.directories.includes, "./src/myincludes/");
        t.is(arg.directories.data, "./src/mydata/");
        t.is(arg.directories.layouts, undefined);
        t.is(arg.directories.output, "./dist/");
      })
    },
  });

  let result = await elev.toJSON();
});

test("Eleventy config export (CommonJS)", async (t) => {
  t.plan(5);
  let elev = new Eleventy("test/stubs/cfg-directories-export-cjs", null, {
    configPath: "./test/stubs/cfg-directories-export-cjs/eleventy.config.cjs",
    config: function (configApi) {
      configApi.on("buildawesome.after", arg => {
        t.is(arg.directories.input, "./src/");
        t.is(arg.directories.includes, "./src/myincludes2/");
        t.is(arg.directories.data, "./src/mydata2/");
        t.is(arg.directories.layouts, undefined);
        t.is(arg.directories.output, "./dist2/");
      })
    },
  });

  let result = await elev.toJSON();
});

test("Eleventy setting reserved data throws error (eleventy)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.html", `---
eleventy:
  key1: NOOOOO
---`);
    }
  });
  elev.disableLogger();

  let e = await t.throwsAsync(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names. You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });

  t.is(e.cause.toString(), "TypeError: Cannot add property key1, object is not extensible");
});

test("Eleventy setting reserved data throws error (pkg)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.html", `---
pkg:
  myOwn: OVERRIDE
---`);
    }
  });
  elev.disableLogger();

  let e = await t.throwsAsync(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names. You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });

  t.is(e.cause.toString(), "TypeError: Cannot add property myOwn, object is not extensible");
});

test("Eleventy pagination works okay with reserved data throws (eleventy) Issue #3262", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.html", `---
pagination:
  data: "test"
  size: 1
test:
  - a
  - b
  - c
---
{{ eleventy.generator }}`);
    }
  });
  elev.disableLogger();

  let result = await elev.toJSON();
  t.is(result.length, 3);
});

test("Eleventy setting reserved data throws error (page)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.html", `---
page: "My page value"
---`)
    }
  });
  elev.disableLogger();

  let e = await t.throwsAsync(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names: page. You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });
});

test("Eleventy setting reserved data throws error (content)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.html", `---
content: "My page value"
---`)
    }
  });
  elev.disableLogger();

  await t.throwsAsync(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names: content. You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });
});

test("Eleventy setting reserved data throws error (collections)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.html", `---
collections: []
---`)
    }
  });
  elev.disableLogger();

  await t.throwsAsync(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names: collections. You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });
});

test("Eleventy setting pkg data is okay when pkg is remapped to parkour", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.html", `---
pkg:
  myOwn: OVERRIDE
---`);
    }
  });
  elev.disableLogger();

  await elev.initializeConfig({
    keys: {
      package: "parkour"
    }
  });

  // Remap successful
  t.is(elev.eleventyConfig.config.keys.package, "parkour");

  let [result] = await elev.toJSON();
  t.deepEqual(result, {
    content: "",
    inputPath: "./test/stubs-virtual/index.html",
    outputPath: "./_site/index.html",
    rawInput: "",
    url: "/"
  });
});

test("Eleventy setting pkg data is okay when keys.package is false", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.html", `---
pkg:
  myOwn: OVERRIDE
---
{{ pkg.myOwn }}`);
    }
  });
  elev.disableLogger();

  await elev.initializeConfig({
    keys: {
      package: false
    }
  });

  // Remap successful
  t.is(elev.eleventyConfig.config.keys.package, false);

  let [result] = await elev.toJSON();
  t.deepEqual(result, {
    content: "OVERRIDE",
    inputPath: "./test/stubs-virtual/index.html",
    outputPath: "./_site/index.html",
    rawInput: "{{ pkg.myOwn }}",
    url: "/"
  });
});

test("Eleventy setting reserved data throws error (pkg remapped to parkour)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.html", `---
parkour:
  myOwn: OVERRIDE
---`);
    }
  });
  elev.disableLogger();

  await elev.initializeConfig({
    keys: {
      package: "parkour"
    }
  });

  // Remap successful
  t.is(elev.eleventyConfig.config.keys.package, "parkour");

  let e = await t.throwsAsync(() => elev.toJSON(), {
    message: 'You attempted to set one of Build Awesome’s reserved data property names. You can opt-out of this behavior with `$config.setFreezeReservedData(false)` or rename/remove the property in your data cascade that conflicts with reserved property names (e.g. `buildawesome`, `eleventy`, `pkg`, and others). Learn more: https://v3.11ty.dev/docs/data-eleventy-supplied/'
  });

  t.is(e.cause.toString(), "TypeError: Cannot add property myOwn, object is not extensible");
});

test("Eleventy data schema (success) #879", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index1.html", "", {
        draft: true,
        eleventyDataSchema: function(data) {
          if(typeof data.draft !== "boolean") {
            throw new Error("Invalid data type for draft.");
          }
        }
      });

      configApi.addTemplate("index2.html", "", {
        draft: true,
        eleventyDataSchema: function(data) {
          if(typeof data.draft !== "boolean") {
            throw new Error("Invalid data type for draft.");
          }
        }
      });
    }
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results.length, 2);
});

test("Eleventy data schema (fails) #879", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index1.html", "", {
        draft: 1,
        eleventyDataSchema: function(data) {
          if(typeof data.draft !== "boolean") {
            throw new Error("Invalid data type for draft.");
          }
        }
      });
    }
  });
  elev.disableLogger();

  let e = await t.throwsAsync(() => elev.toJSON(), {
    message: 'Error in the data schema for: ./test/stubs-virtual/index1.html (via `buildawesomeDataSchema` or `eleventyDataSchema`)'
  });

  t.is(e.cause.toString(), "Error: Invalid data type for draft.");
});

test("Eleventy data schema (fails, using zod) #879", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index1.html", "", {
        draft: 1,
        eleventyDataSchema: function(data) {
          let result = z.object({
            draft: z.boolean().or(z.undefined()),
          }).safeParse(data);

          if(result.error) {
            throw fromZodError(result.error);
          }
        }
      });
    }
  });
  elev.disableLogger();

  let e = await t.throwsAsync(() => elev.toJSON(), {
    message: 'Error in the data schema for: ./test/stubs-virtual/index1.html (via `buildawesomeDataSchema` or `eleventyDataSchema`)'
  });

  t.is(e.cause.toString(), 'Validation error: Invalid input: expected boolean, received number at "draft" or Invalid input: expected undefined, received number at "draft"');
});

test("Eleventy data schema has access to custom collections created via API #879", async (t) => {
  t.plan(2);
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addCollection("userCollection", function (collection) {
        return collection.getAll();
      });

      configApi.addTemplate("index1.html", "", {
        eleventyDataSchema: function(data) {
          t.is(data.collections.userCollection.length, 1);
        }
      });
    }
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results.length, 1);
});

test("Eleventy transforms filter (using collections and page override data)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    pathPrefix: "hi",
    config: configApi => {
      configApi.addPlugin(HtmlBasePlugin);

      configApi.addTemplate("index.html", `<img src="/test.png" alt="abc">`, { tags: "posts" });
      configApi.addTemplate("feed.njk", `{% for post in collections.posts %}{{ post.content | renderTransforms(post.page) | safe }}{% endfor %}`, {
        permalink: "feed.xml"
      });
    }
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results.length, 2);

  t.is(results.filter(({inputPath}) => inputPath.endsWith("index.html"))[0].content, `<img src="/hi/test.png" alt="abc">`);
  t.is(results.filter(({inputPath}) => inputPath.endsWith("feed.njk"))[0].content, `<img src="/hi/test.png" alt="abc">`);
});

test("Custom Markdown Render with permalink, Issue #2780", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addExtension("md", {
        compile: str => {
          return data => marked.parse(str);
        }
      });

      configApi.addTemplate("template.md", `# Markdown?`, { permalink: "/permalink.html" });
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].url, `/permalink.html`);
  t.is(results[0].content.trim(), `<h1>Markdown?</h1>`);
});

test("Custom Markdown Render with permalink, Issue #2780 #3339", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplateFormats("markdown");
      configApi.addExtension("markdown", {
        key: "md"
      });

      configApi.addTemplate("filename-hi.markdown", `# Markdown?`, { permalink: "/{{ page.fileSlug }}.html" });
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].url, `/filename-hi.html`);
  t.is(results[0].content.trim(), `<h1>Markdown?</h1>`);
});

test("Test input/output conflicts (input overwrites output), Issue #3327", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: configApi => {
      configApi.addTemplate("test.html", `# Markdown`, { permalink: "test.html" });
    }
  });
  elev.disableLogger();

  let e = await t.throwsAsync(async () => {
    await elev.toJSON();
  });
  t.true(e.toString().startsWith("DuplicatePermalinkOutputError:"));
});

test("Test input/output conflicts (output overwrites another input), Issue #3327", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: configApi => {
      configApi.addTemplate("test.html", `# Markdown`);
      configApi.addTemplate("index.html", `# Markdown`, { permalink: "test.html" });
    }
  });
  elev.disableLogger();

  let e = await t.throwsAsync(async () => {
    await elev.toJSON();
  });
  t.true(e.toString().startsWith("DuplicatePermalinkOutputError:"));
});

test("Eleventy data schema has access to custom collections created via API #613 #3345", async (t) => {

  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addCollection("userCollection", async function (collection) {
        let c = collection.getFilteredByTag("posts");
        for(let item of c) {
          const frontMatter = await item.template.read();
          frontMatter.content = `lol\n${frontMatter.content}`;
          item.template.frontMatter = frontMatter;
        }
        return c;
      });

      configApi.addTemplate("home.html", "{% for post in collections.userCollection %}{{ post.content }}{% endfor %}");
      configApi.addTemplate("post.html", "test", { tags: "posts" });
    }
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  let [home] = results.filter(item => item.url.endsWith("/home/"));
  t.truthy(home);
  t.is(home.content, "test");
});

test("Custom Nunjucks syntax has shortcode with access to `this`, Issue #3310", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addShortcode("customized", function(argString) {
        return `${this.page.url}:${argString}:Custom Shortcode`;
      });

      let njkEnv = new nunjucks.Environment();

      function CustomExtension() {
        this.tags = ['customized'];

        this.parse = function(parser, nodes, lexer) {
          let args;
          let tok = parser.nextToken();
          args = parser.parseSignature(true, true);
          parser.advanceAfterBlockEnd(tok.value);
          return new nodes.CallExtension(this, "run", args);
        };

        this.run = function(context, argString) {
          let fn = configApi.augmentFunctionContext(
            configApi.getShortcode("customized"),
            {
              source: context.ctx,
              // lazy: false,
              // getter: (key, context) => context?.[key];
              // overwrite: true,
            }
          );

          return fn(argString);
        };
      }

      njkEnv.addExtension('CustomExtension', new CustomExtension());

      configApi.addTemplateFormats("njknew");

      configApi.addExtension("njknew", {
        compile: (str, inputPath) => {
          let tmpl = new nunjucks.Template(str, njkEnv, inputPath, false);
          return function(data) {
            return new Promise(function (resolve, reject) {
              tmpl.render(data, function (err, res) {
                if (err) {
                  reject(err);
                } else {
                  resolve(res);
                }
              });
            });
          }
        }
      });

      configApi.addTemplate("template.njknew", `<h1>{{ hello }}:{% customized "passed in" %}</h1>`, {
        hello: "goodbye"
      });
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].content.trim(), `<h1>goodbye:/template/:passed in:Custom Shortcode</h1>`);
});

test("Related to issue 3206: Does Nunjucks throwOnUndefined variables require normalizeContext to be a lazy get", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addShortcode("customized", function(argString) {
        return `${this.page.url}:Custom Shortcode`;
      });

      $config.setNunjucksEnvironmentOptions({
        throwOnUndefined: true,
      });

      $config.addTemplate("index.html", `HELLO{% customized %}:{{ page.url }}`);
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].content.trim(), `HELLO/:Custom Shortcode:/`);
});

test("#727: Error messaging when trying to use a missing layout", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addTemplate("index.html", `HELLO {{ page.url }}`, {
        layout: "does-not-exist.html",
      });
    }
  });
  elev.disableLogger();

  await t.throwsAsync(() => elev.toJSON(), {
    message: `Problem creating an Eleventy Layout for the "./test/stubs-virtual/index.html" template file.`
  });
});

test("#1419: Shortcode in a permalink", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addShortcode("shortcode", () => "url-slug");
      $config.addTemplate("index.njk", "", {
        permalink: "/{% shortcode %}/",
      });
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].url, `/url-slug/`);
});

test("#3373: Throw an error when explicit config path is not found.", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    configPath: "this-file-is-not-found.js"
  });

  let e = await t.throwsAsync(() => elev.toJSON());
  t.is(e.message, "A configuration file was specified but not found: this-file-is-not-found.js");
});

test("Eleventy loader can force ESM mode", async (t) => {
  let elev = new Eleventy("./README.md", "./_site", {
    loader: "esm",
  });

  t.is(elev.isEsm, true);
});

test("Eleventy loader can force CommonJS mode", async (t) => {
  let elev = new Eleventy("./README.md", "./_site", {
    loader: "cjs",
  });

  t.is(elev.isEsm, false);
});

test("Truthy outputPath without a file extension now throws an error, issue #3399", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      // $config.configureErrorReporting({ allowMissingExtensions: true });
      $config.addTemplate("index.html", "", { permalink: "foo" })
    },
  });
  elev.disableLogger();

  await t.throwsAsync(() => elev.toJSON(), {
    // The `set*Directory` configuration API methods are not yet allowed in plugins.
    message: `The template at './test/stubs-virtual/index.html' attempted to write to './_site/foo' (via \`permalink\` value: 'foo'), which is a target on the file system that does not include a file extension.

You *probably* want to add a file extension to your permalink so that hosts will know how to correctly serve this file to web browsers. Without a file extension, this file may not be reliably deployed without additional hosting configuration (it won’t have a mime type) and may also cause local development issues if you later attempt to write to a subdirectory of the same name.

Learn more: https://v3.11ty.dev/docs/permalinks/#trailing-slashes

This is usually but not *always* an error so if you’d like to disable this error message, add \`eleventyAllowMissingExtension: true\` somewhere in the data cascade for this template or use \`$config.configureErrorReporting({ allowMissingExtensions: true });\` to disable this feature globally.`
  });
});

test("Truthy outputPath without a file extension can be ignored, issue #3399", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      // $config.configureErrorReporting({ allowMissingExtensions: true });
      $config.addTemplate("index.html", "", { permalink: "foo", eleventyAllowMissingExtension: true })
    },
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].url, "/foo");
});


test("Allow list for some file types without a file extension, issue #3399", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.addTemplate("index.html", "", { permalink: "/test/_redirects" })
    },
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].url, "/test/_redirects");
});

test("Truthy outputPath without a file extension error message is disabled, issue #3399", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.configureErrorReporting({ allowMissingExtensions: true });
      $config.addTemplate("index.html", "", { permalink: "foo" })
    },
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results.length, 1);
});

test("permalink: false outputPath new error message won’t throw an error, issue #3399", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.addTemplate("index.html", "", { permalink: false })
    },
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results.length, 1);
});

test("permalink on custom template lang, issue #3619", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.addGlobalData("permalink", () => {
        return (data) =>
          `/rewrite/${data.page.filePathStem}.${data.page.outputFileExtension}`;
      });

      $config.addTemplateFormats("scss");

      $config.addExtension("scss", {
        outputFileExtension: "css",
        compileOptions: {
    			permalink(inputContent, inputPath) {
    				return (data) => {
    					return `/testing/${data.permalink(data)}`;
    				}
    			}
    		},
        compile: function (str, inputPath) {
          // TODO declare data variables as SASS variables?
          return async function (data) {
            return new Promise(function (resolve, reject) {
              sass.render(
                {
                  data: str,
                  outFile: "test_this_is_to_not_write_a_file.css",
                },
                function (error, result) {
                  if (error) {
                    reject(error);
                  } else {
                    resolve(result.css.toString("utf8"));
                  }
                },
              );
            });
          };
        },
      });

      $config.addTemplate("index.scss", `html {
  color: red;
}`)
    },
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results[0].url, "/testing/rewrite/index.css");
  t.is(results[0].content, `html {
  color: red;
}`);
});

test("Template data throws error when tags is not an Array or String #1791", async (t) => {
  let elev = new Eleventy("./test/noop/", "./test/noop/_site", {
    config: function ($config) {
      $config.addTemplate("index.html", "", {
        tags: {"one": 1, "two": 2}
      });
    },
  });
  elev.disableLogger();

  await t.throwsAsync(() => elev.toJSON(), {
    // The `set*Directory` configuration API methods are not yet allowed in plugins.
    message: "String or Array expected for `tags` in virtual template: ./test/noop/index.html. Received: { one: 1, two: 2 }",
  });
});

test("sass docs on 11ty.dev, issue #408", async (t) => {
  let elev = new Eleventy("./test/stubs-408-sass/", undefined, {
    config: function ($config) {
      $config.addTemplateFormats("scss");

      $config.addExtension("scss", {
        outputFileExtension: "css",

        // opt-out of Eleventy Layouts
        useLayouts: false,

        compile: async function (inputContent, inputPath) {
          let parsed = path.parse(inputPath);
          if(parsed.name.startsWith("_")) {
            return;
          }

          let result = sass.compileString(inputContent, {
            loadPaths: [
              parsed.dir || ".",
              this.config.dir.includes
            ]
          });

          this.addDependencies(inputPath, result.loadedUrls);

          return async (data) => {
            return result.css;
          };
        },
      });
    },
  });
  elev.disableLogger();

   let results = await elev.toJSON();
   t.is(results.length, 2);

   let code = results.filter(entry => entry.inputPath.endsWith("_code.scss"))[0];
   t.is(code.url, "/_code.css");
   t.is(code.content, undefined);

   let main = results.filter(entry => entry.inputPath.endsWith("style.scss"))[0];
   t.is(main.url, "/style.css");
   t.is(
    normalizeNewLines(main.content),
    `code {
  padding: 0.25em;
  line-height: 0;
}

/* Comment */`);
});

test("Use a date object for `date`, issue #3022", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.dataFilterSelectors.add("page.date");
      $config.addTemplate("index.html", "", { date: new Date() })
    },
  });
  elev.disableLogger();

 let results = await elev.toJSON();
 t.is(results.length, 1);
 t.truthy(results[0].data.page.date instanceof Date);
});

test("Use a date object for `date` (js object front matter), issue #3022", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.dataFilterSelectors.add("page.date");
      $config.addTemplate("index.html", `---js
{
  date: new Date(),
}
---`);
    },
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.truthy(results[0].data.page.date instanceof Date);
});

test("Use a date object for `date` (js front matter), issue #3022", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.dataFilterSelectors.add("page.date");
      $config.addTemplate("index.html", `---js
let date = new Date();
---`);
    },
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.truthy(results[0].data.page.date instanceof Date);
});

test("Cleaner constructor args #3880", async (t) => {
  let elev = new Eleventy({
    input: "./test/stubs-virtual/",
    config: $config => {
      $config.addTemplate("index.md", `# Title`)
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].content.trim(), `<h1>Title</h1>`);
});
