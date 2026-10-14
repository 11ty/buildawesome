import test from "ava";
import fs from "fs";
import { glob } from "tinyglobby";
import path from "path";

import ExtensionMap from "../src/ExtensionMap.js";
import { isTypeScriptSupported } from "../src/Util/TypeScriptFeatureTest.cjs";

import { normalizeNewLines } from "./Util/normalizeNewLines.js";
import { getRenderedTemplates as getRenderedTmpls } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback, getTemplateWriterInstance, deleteDirectory } from "./_testHelpers.js";

// TODO make sure if output is a subdir of input dir that they don’t conflict.
test("Output is a subdir of input", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/writeTest",
      output: "test/stubs/writeTest/_writeTestSite"
    }
  });

  let { templateWriter: tw, eleventyFiles: evf } = getTemplateWriterInstance(["liquid", "md"], eleventyConfig);

  let files = await glob(evf.getFileGlobs());
  t.deepEqual(evf.getRawFiles(), ["./test/stubs/writeTest/**/*.{liquid,md}"]);
  t.true(files.length > 0);

  let { template: tmpl } = tw.createTemplate(files[0]);
  t.is(tmpl.inputDir, "./test/stubs/writeTest/");

  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./test/stubs/writeTest/_writeTestSite/test/index.html");
});

test("createTemplateMap", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/writeTest",
      output: "test/stubs/writeTest/_writeTestSite"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["liquid", "md"], eleventyConfig);

  let paths = await tw._getAllPaths();
  t.true(paths.length > 0);
  t.is(paths[0], "./test/stubs/writeTest/test.md");

  let templateMap = await tw.createTemplateMap(paths);
  let map = templateMap.getMap();
  t.true(map.length > 0);
  t.truthy(map[0].template);
  t.truthy(map[0].data);
});

test("createTemplateMap (no leading dot slash)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/writeTest",
      output: "test/stubs/_writeTestSite"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["liquid", "md"], eleventyConfig);

  let paths = await tw._getAllPaths();
  t.true(paths.length > 0);
  t.is(paths[0], "./test/stubs/writeTest/test.md");
});

test("_testGetCollectionsData", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/collection",
      output: "test/stubs/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["md"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.post.length, 2);
  t.is(collectionsData.cat.length, 2);
  t.is(collectionsData.dog.length, 1);
});

// TODO remove this (used by other test things)
test("_testGetAllTags", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/collection",
      output: "test/stubs/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["md"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);
  let tags = templateMap._testGetAllTags();

  t.deepEqual(tags.sort(), ["cat", "dog", "post", "office"].sort());
});

test("Collection of files sorted by date", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/dates",
      output: "test/stubs/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(
    ["md"],
    eleventyConfig,
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.dateTestTag.length, 6);
});

test("__testGetCollectionsData with custom collection (ascending)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/collection2",
    output: "test/stubs/_site"
  }, function(config) {
    config.addCollection("customPostsAsc", function (collection) {
      return collection.getFilteredByTag("post").sort(function (a, b) {
        return a.date - b.date;
      });
    });
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["md"], eleventyConfig);
  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.customPostsAsc.length, 2);
  t.is(path.parse(collectionsData.customPostsAsc[0].inputPath).base, "test1.md");
  t.is(path.parse(collectionsData.customPostsAsc[1].inputPath).base, "test2.md");
});

test("__testGetCollectionsData with custom collection (descending)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/collection2",
    output: "test/stubs/_site"
  }, function(eleventyConfig) {
    eleventyConfig.addCollection("customPosts", function (collection) {
      return collection.getFilteredByTag("post").sort(function (a, b) {
        return b.date - a.date;
      });
    });
  });


  let { templateWriter: tw } = getTemplateWriterInstance(["md"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();

  t.is(collectionsData.customPosts.length, 2);
  t.is(path.parse(collectionsData.customPosts[0].inputPath).base, "test2.md");
  t.is(path.parse(collectionsData.customPosts[1].inputPath).base, "test1.md");
});

test("__testGetCollectionsData with custom collection (filter only to markdown input)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/collection2",
    output: "test/stubs/_site"
  }, function(config) {
    config.addCollection("onlyMarkdown", function (collection) {
      return collection.getAllSorted().filter(function (item) {
        let extension = item.inputPath.split(".").pop();
        return extension === "md";
      });
    });
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["md"], eleventyConfig);


  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.onlyMarkdown.length, 2);
  t.is(path.parse(collectionsData.onlyMarkdown[0].inputPath).base, "test1.md");
  t.is(path.parse(collectionsData.onlyMarkdown[1].inputPath).base, "test2.md");
});

test("Pagination with a Collection", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/paged/collection",
      output: "test/stubs/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["njk"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.tag1.length, 3);
  t.is(collectionsData.pagingtag.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath("./test/stubs/paged/collection/main.njk");
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/paged/collection/main.njk");
  t.is(mapEntry._pages.length, 2);
  t.is(mapEntry._pages[0].outputPath, "./test/stubs/_site/main/index.html");
  t.is(mapEntry._pages[1].outputPath, "./test/stubs/_site/main/1/index.html");

  t.is(mapEntry._pages[0].templateContent.trim(), "<ol><li>/test1/</li><li>/test2/</li></ol>");
  t.is(mapEntry._pages[1].templateContent.trim(), "<ol><li>/test3/</li></ol>");
});

test("Pagination with a Collection from another Paged Template", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/paged/cfg-collection-tag-cfg-collection",
      output: "test/stubs/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["njk"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.tag1.length, 3);
  t.is(collectionsData.pagingtag.length, 2);

  let map1 = templateMap.getMapEntryForInputPath(
    "./test/stubs/paged/cfg-collection-tag-cfg-collection/paged-main.njk",
  );
  t.is(map1._pages[0].templateContent.trim(), "<ol><li>/test1/</li><li>/test2/</li></ol>");
  t.is(map1._pages[1].templateContent.trim(), "<ol><li>/test3/</li></ol>");

  let map2 = templateMap.getMapEntryForInputPath(
    "./test/stubs/paged/cfg-collection-tag-cfg-collection/paged-downstream.njk",
  );
  t.is(map2._pages[0].templateContent.trim(), "<ol><li>/paged-main/</li></ol>");
  t.is(map2._pages[1].templateContent.trim(), "<ol><li>/paged-main/1/</li></ol>");
});

test("Pagination with a Collection (apply all pages to collections)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/paged/collection-apply-to-all",
      output: "test/stubs/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["njk"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.tag1.length, 3);
  t.is(collectionsData.pagingtag.length, 2);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/paged/collection-apply-to-all/main.njk",
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/paged/collection-apply-to-all/main.njk");

  let { template: mainTmpl } = tw.createTemplate(
    "./test/stubs/paged/collection-apply-to-all/main.njk",
  );
  let data = await mainTmpl.getData();
  let outputPath = await mainTmpl.getOutputPath(data);
  t.is(outputPath, "./test/stubs/_site/main/index.html");

  let templates = await getRenderedTmpls(mapEntry.template, mapEntry.data);
  t.is(templates.length, 2);
  t.is(
    await templates[0].template.getOutputPath(templates[0].data),
    "./test/stubs/_site/main/index.html",
  );
  t.is(templates[0].outputPath, "./test/stubs/_site/main/index.html");
  t.is(
    await templates[1].template.getOutputPath(templates[1].data),
    "./test/stubs/_site/main/1/index.html",
  );
  t.is(templates[1].outputPath, "./test/stubs/_site/main/1/index.html");

  // test content
  t.is(templates[0].templateContent.trim(), "<ol><li>/test1/</li><li>/test2/</li></ol>");
  t.is(templates[1].templateContent.trim(), "<ol><li>/test3/</li></ol>");
});

test("Use a collection inside of a template", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/collection-template",
      output: "test/stubs/collection-template/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["liquid"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.dog.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/collection-template/template.liquid",
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/collection-template/template.liquid");

  let { template: mainTmpl } = tw.createTemplate(
    "./test/stubs/collection-template/template.liquid",
  );
  let data = await mainTmpl.getData();
  let outputPath = await mainTmpl.getOutputPath(data);
  t.is(outputPath, "./test/stubs/collection-template/_site/template/index.html");

  let templates = await getRenderedTmpls(mapEntry.template, mapEntry.data);

  // test content
  t.is(
    normalizeNewLines(templates[0].templateContent.trim()),
    `Layout

Template

All 2 templates
Template 1 dog`,
  );
});

test("Use a collection inside of a layout", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/collection-layout",
      output: "test/stubs/collection-layout/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["liquid"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.dog.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/collection-layout/template.liquid",
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/collection-layout/template.liquid");

  let { template: mainTmpl } = tw.createTemplate("./test/stubs/collection-layout/template.liquid");
  let data = await mainTmpl.getData();
  let outputPath = await mainTmpl.getOutputPath(data);
  t.is(outputPath, "./test/stubs/collection-layout/_site/template/index.html");

  let templates = await getRenderedTmpls(mapEntry.template, mapEntry.data);

  // test content
  t.is(
    normalizeNewLines(templates[0].templateContent.trim()),
    `Layout

Template

All 2 templates
Layout 1 dog`,
  );
});

test("Glob Watcher Files with Passthroughs", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs",
      output: "test/stubs/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["njk", "png"], eleventyConfig);

  t.deepEqual(tw.getPassthroughGlobs(), ["./test/stubs/**/*.png"]);
});

test("Pagination and TemplateContent", async (t) => {
  deleteDirectory("./test/stubs/pagination-templatecontent/_site/");

  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/pagination-templatecontent",
      output: "test/stubs/pagination-templatecontent/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["njk", "md"], eleventyConfig);
  await tw.write();

  let content = fs.readFileSync("./test/stubs/pagination-templatecontent/_site/index.html", "utf8");
  t.is(
    content.trim(),
    `<h1>Post 1</h1>
<h1>Post 2</h1>`,
  );

  deleteDirectory("./test/stubs/pagination-templatecontent/_site/");
});

test("Custom collection returns array", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/collection2",
    output: "test/stubs/_site"
  }, function(config) {
    config.addCollection("returnAllInputPaths", function (collection) {
      return collection.getAllSorted().map(function (item) {
        return item.inputPath;
      });
    });
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["md"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.returnAllInputPaths.length, 2);
  t.is(path.parse(collectionsData.returnAllInputPaths[0]).base, "test1.md");
  t.is(path.parse(collectionsData.returnAllInputPaths[1]).base, "test2.md");
});

test("Custom collection returns a string", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/collection2",
    output: "test/stubs/_site"
  }, function(config) {
    config.addCollection("returnATestString", function () {
      return "test";
    });
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["md"], eleventyConfig);
  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.returnATestString, "test");
});

test("Custom collection returns an object", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/collection2",
    output: "test/stubs/_site"
  }, function(config) {
    config.addCollection("returnATestObject", function () {
      return { test: "value" };
    });
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["md"], eleventyConfig);
  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.deepEqual(collectionsData.returnATestObject, { test: "value" });
});

test("fileSlug should exist in a collection", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/collection-slug",
      output: "test/stubs/collection-slug/_site"
    }
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["njk"], eleventyConfig);

  let paths = await tw._getAllPaths();
  let templateMap = await tw.createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.dog.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath("./test/stubs/collection-slug/template.njk");
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/collection-slug/template.njk");

  let templates = await getRenderedTmpls(mapEntry.template, mapEntry.data);
  t.is(templates[0].templateContent.trim(), "fileSlug:/dog1/:dog1");
});

test("Write Test 11ty.js", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/writeTestJS",
      output: "test/stubs/_writeTestJSSite"
    }
  });

  let { templateWriter: tw, eleventyFiles: evf } = getTemplateWriterInstance(["11ty.js"], eleventyConfig);

  let files = await glob(evf.getFileGlobs());
  t.deepEqual(evf.getRawFiles(), [`./test/stubs/writeTestJS/**/*.{server.js,server.cjs,server.mjs,11ty.js,11ty.cjs,11ty.mjs,server.ts,server.cts,server.mts,11ty.ts,11ty.cts,11ty.mts}`]);
  t.deepEqual(files, ["test/stubs/writeTestJS/test.11ty.cjs"]);

  let { template: tmpl } = tw.createTemplate(files[0]);
  let data = await tmpl.getData();
  t.is(await tmpl.getOutputPath(data), "./test/stubs/_writeTestJSSite/test/index.html");
});

test.skip("Markdown with alias", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/writeTestMarkdown",
      output: "test/stubs/_writeTestMarkdownSite"
    }
  });

  let map = new ExtensionMap(eleventyConfig);
  map.setFormats(["md"]);
  map.config = {
    templateExtensionAliases: {
      markdown: "md",
    },
  };

  let { templateWriter: tw, eleventyFiles: evf } = getTemplateWriterInstance(["md"], eleventyConfig);
  evf._setExtensionMap(map);
  evf.init();

  let files = await glob(evf.getFileGlobs());
  t.deepEqual(evf.getRawFiles(), [
    "./test/stubs/writeTestMarkdown/**/*.md",
    "./test/stubs/writeTestMarkdown/**/*.markdown",
  ]);
  t.true(files.indexOf("./test/stubs/writeTestMarkdown/sample.md") > -1);
  t.true(files.indexOf("./test/stubs/writeTestMarkdown/sample2.markdown") > -1);

  let { template: tmpl } = tw.createTemplate(files[0]);
  tmpl._setExtensionMap(map);
  t.is(await tmpl.getOutputPath(), "./test/stubs/_writeTestMarkdownSite/sample/index.html");

  let { template: tmpl2 } = tw.createTemplate(files[1]);
  tmpl2._setExtensionMap(map);
  t.is(await tmpl2.getOutputPath(), "./test/stubs/_writeTestMarkdownSite/sample2/index.html");
});

test.skip("JavaScript with alias", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: "test/stubs/writeTestJS",
      output: "test/stubs/_writeTestJSSite"
    }
  });

  let map = new ExtensionMap(eleventyConfig);
  map.setFormats(["11ty.js"]);
  map.config = {
    templateExtensionAliases: {
      js: "11ty.js",
    },
  };

  let { templateWriter: tw, eleventyFiles: evf } = getTemplateWriterInstance(["11ty.js"], eleventyConfig);

  evf._setExtensionMap(map);
  evf.init();

  let files = await glob(evf.getFileGlobs());
  t.deepEqual(
    evf.getRawFiles().sort(),
    ["./test/stubs/writeTestJS/**/*.11ty.js", "./test/stubs/writeTestJS/**/*.js"].sort(),
  );
  t.deepEqual(
    files.sort(),
    ["./test/stubs/writeTestJS/sample.js", "./test/stubs/writeTestJS/test.11ty.js"].sort(),
  );

  let { template: tmpl } = tw.createTemplate(files[0]);
  t.is(await tmpl.getOutputPath(), "./test/stubs/_writeTestJSSite/test/index.html");
});

test("Passthrough file output", async (t) => {
  deleteDirectory("./test/stubs/template-passthrough/_site/");

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs/template-passthrough",
    output: "test/stubs/template-passthrough/_site"
  }, function(cfg){
    cfg.addPassthroughCopy("./test/stubs/template-passthrough/static");
    cfg.addPassthroughCopy({
			"./test/stubs/template-passthrough/static/": "./",
    });
    cfg.addPassthroughCopy({
			"./test/stubs/template-passthrough/static/**/*": "./all/",
    });
    cfg.addPassthroughCopy({
			"./test/stubs/template-passthrough/static/**/*.js": "./js/",
    });

    // cfg.passthroughCopies = {
    //   "./test/stubs/template-passthrough/static": {
    //     outputPath: true,
    //   },
    //   "./test/stubs/template-passthrough/static/": {
    //     outputPath: "./",
    //   },
    //   "./test/stubs/template-passthrough/static/**/*": {
    //     outputPath: "./all/",
    //   },
    //   "./test/stubs/template-passthrough/static/**/*.js": {
    //     outputPath: "./js/",
    //   },
    // };
  });

  let { templateWriter: tw } = getTemplateWriterInstance(["njk", "md"], eleventyConfig);

  await tw.write();

  const output = [
    "./test/stubs/template-passthrough/_site/static/nested/test-nested.css",
    "./test/stubs/template-passthrough/_site/all/test.js",
    "./test/stubs/template-passthrough/_site/all/test.css",
    "./test/stubs/template-passthrough/_site/all/test-nested.css",
    "./test/stubs/template-passthrough/_site/js/",
    "./test/stubs/template-passthrough/_site/js/test.js",
    "./test/stubs/template-passthrough/_site/nested/",
    "./test/stubs/template-passthrough/_site/nested/test-nested.css",
    "./test/stubs/template-passthrough/_site/test.css",
    "./test/stubs/template-passthrough/_site/test.js",
  ];

  for (let path of output) {
    t.true(fs.existsSync(path));
  }

  deleteDirectory("./test/stubs/template-passthrough/_site/");
});
