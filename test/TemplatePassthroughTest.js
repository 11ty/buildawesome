import test from "node:test";

import FileSystemSearch from "../src/FileSystemSearch.js";
import TemplatePassthrough from "../src/TemplatePassthrough.js";

import { getTemplateConfigInstance } from "./_testHelpers.js";

async function getTemplatePassthrough(path, outputDir, inputDir) {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: inputDir,
      output: outputDir,
    }
  });

  if (typeof path === "object") {
    let p = new TemplatePassthrough(path, eleventyConfig);
    p.setFileSystemSearch(new FileSystemSearch());
    return p;
  }

  let p = new TemplatePassthrough(
    { inputPath: path, outputPath: true },
    eleventyConfig
  );
  p.setFileSystemSearch(new FileSystemSearch());
  return p;
}

test("Constructor", async (t) => {
  let pass = await getTemplatePassthrough("avatar.png", "_site", ".");
  t.assert.ok(pass);
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/avatar.png");
});

test("Constructor, input directory in inputPath is stripped", async (t) => {
  let pass = await getTemplatePassthrough("src/avatar.png", "_site", "src");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/avatar.png");

  let pass2 = await getTemplatePassthrough(
    { inputPath: "src/avatar.png", outputPath: "avatar.png" },
    "_site",
    "src"
  );
  t.assert.strictEqual(pass2.outputPath, "avatar.png");
  t.assert.strictEqual(await pass2.getOutputPath(), "_site/avatar.png");
});

test("Constructor, input directory in inputPath is stripped, duplicate directory names", async (t) => {
  let pass = await getTemplatePassthrough("src/src/avatar.png", "_site", "src");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/src/avatar.png");

  let pass2 = await getTemplatePassthrough(
    { inputPath: "src/src/avatar.png", outputPath: "src/avatar.png" },
    "_site",
    "src"
  );
  t.assert.strictEqual(pass2.outputPath, "src/avatar.png");
  t.assert.strictEqual(await pass2.getOutputPath(), "_site/src/avatar.png");
});

test("Constructor, input directory (object param, directory)", async (t) => {
  let pass = await getTemplatePassthrough(
    { inputPath: "src/test", outputPath: "test" },
    "_site",
    "src"
  );
  t.assert.strictEqual(pass.outputPath, "test");
  t.assert.strictEqual(await pass.getOutputPath(), "_site/test");
});

test("Constructor, input directory, path missing input directory", async (t) => {
  let pass = await getTemplatePassthrough("avatar.png", "_site", "src");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/avatar.png");

  let pass2 = await getTemplatePassthrough(
    { inputPath: "avatar.png", outputPath: "avatar.png" },
    "_site",
    "src"
  );
  t.assert.strictEqual(pass2.outputPath, "avatar.png");
  t.assert.strictEqual(await pass2.getOutputPath(), "_site/avatar.png");
});

test("Constructor not Dry Run", async (t) => {
  let pass = await getTemplatePassthrough("avatar.png", "_site", ".");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(pass.isDryRun, false);
});

test("Constructor Dry Run", async (t) => {
  let pass = await getTemplatePassthrough("avatar.png", "_site", ".");
  pass.setDryRun(true);
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(pass.isDryRun, true);
});

test("Origin path isn’t included in output when targeting a directory", async (t) => {
  let pass = await getTemplatePassthrough("img", "_site", "test/stubs");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/img");
});

test("Origin path isn’t included in output when targeting a directory several levels deep", async (t) => {
  let pass = await getTemplatePassthrough("img", "_site", "test/stubs/subdir");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/img");
});

test("Target directory’s subdirectory structure is retained", async (t) => {
  let pass = await getTemplatePassthrough("subdir/img", "_site", "test/stubs");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/subdir/img");

  let pass2 = await getTemplatePassthrough(
    { inputPath: "subdir/img", outputPath: "subdir/img" },
    "_site",
    "test/stubs"
  );
  t.assert.strictEqual(await pass2.getOutputPath(), "_site/subdir/img");
});

test("Origin path isn’t included in output when targeting a file", async (t) => {
  let pass = await getTemplatePassthrough("avatar.png", "_site", "test/stubs");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/avatar.png");
});

test("Origin path isn’t included in output when targeting a file several levels deep", async (t) => {
  let pass = await getTemplatePassthrough("avatar.png", "_site", "test/stubs/subdir/img");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/avatar.png");
});

test("Full input file path and deep input path", async (t) => {
  let tp = await getTemplatePassthrough("test/views/avatar.png", "_site", "test/views/");
  t.assert.strictEqual(await tp.getOutputPath(), "_site/avatar.png");

  let tp2 = await getTemplatePassthrough("test/views/avatar.png", "_site", "test/views");
  t.assert.strictEqual(await tp2.getOutputPath(), "_site/avatar.png");

  let tp3 = await getTemplatePassthrough("test/views/avatar.png", "_site/", "test/views");
  t.assert.strictEqual(await tp3.getOutputPath(), "_site/avatar.png");

  let tp4 = await getTemplatePassthrough("test/views/avatar.png", "./_site", "./test/views");
  t.assert.strictEqual(await tp4.getOutputPath(), "_site/avatar.png");

  let tp5 = await getTemplatePassthrough("./test/views/avatar.png", "./_site/", "./test/views/");
  t.assert.strictEqual(await tp5.getOutputPath(), "_site/avatar.png");

  let tp6 = await getTemplatePassthrough("./test/views/avatar.png", "_site", "test/views/");
  t.assert.strictEqual(await tp6.getOutputPath(), "_site/avatar.png");
});

test(".htaccess", async (t) => {
  let pass = await getTemplatePassthrough(".htaccess", "_site", ".");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/.htaccess");
});

test(".htaccess with input dir", async (t) => {
  let pass = await getTemplatePassthrough(".htaccess", "_site", "test/stubs");
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/.htaccess");
});

test("getFiles where not glob and file does not exist", async (t) => {
  const inputPath = ".htaccess";
  let pass = await getTemplatePassthrough(inputPath, "_site", "test/stubs");
  t.assert.strictEqual(pass.outputPath, true);
  const files = await pass.getFiles(inputPath);
  t.assert.deepStrictEqual(files, []);
});

test("getFiles where not glob and directory does not exist", async (t) => {
  const inputPath = "./test/stubs/template-passthrough/static/not-exists/";
  let pass = await getTemplatePassthrough(inputPath, "_site", "test/stubs");
  t.assert.strictEqual(pass.outputPath, true);
  const files = await pass.getFiles(inputPath);
  t.assert.deepStrictEqual(files, []);
});

test("getFiles with glob", async (t) => {
  const inputPath = "./test/stubs/template-passthrough/static/**";
  let pass = await getTemplatePassthrough(inputPath, "_site", "test/views");
  t.assert.strictEqual(pass.outputPath, true);

  const files = await pass.getFiles(inputPath);
  t.assert.deepStrictEqual(
    files.sort(),
    [
      "./test/stubs/template-passthrough/static/test.css",
      "./test/stubs/template-passthrough/static/test.js",
      "./test/stubs/template-passthrough/static/nested/test-nested.css",
    ].sort()
  );

  t.assert.strictEqual(
    await pass.getOutputPath(files.filter((entry) => entry.endsWith("test.css"))[0]),
    "_site/test/stubs/template-passthrough/static/test.css"
  );
  t.assert.strictEqual(
    await pass.getOutputPath(files.filter((entry) => entry.endsWith("test.js"))[0]),
    "_site/test/stubs/template-passthrough/static/test.js"
  );
  t.assert.strictEqual(
    await pass.getOutputPath(files.filter((entry) => entry.endsWith("test-nested.css"))[0]),
    "_site/test/stubs/template-passthrough/static/nested/test-nested.css"
  );
});
test("getFiles with glob 2", async (t) => {
  const inputPath = "./test/stubs/template-passthrough/static/**/*.js";
  let pass = await getTemplatePassthrough(inputPath, "_site", "test/views");
  t.assert.strictEqual(pass.outputPath, true);
  const files = await pass.getFiles(inputPath);
  t.assert.deepStrictEqual(files, ["./test/stubs/template-passthrough/static/test.js"]);
  t.assert.strictEqual(await pass.getOutputPath(files[0]), "_site/test/stubs/template-passthrough/static/test.js");
});

test("Directory where outputPath is true", async (t) => {
  let pass = await getTemplatePassthrough(
    { inputPath: "./static", outputPath: true },
    "_site",
    "test/stubs"
  );
  t.assert.strictEqual(pass.outputPath, true);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/static");
});

test("Nested directory where outputPath is remapped", async (t) => {
  let pass = await getTemplatePassthrough(
    { inputPath: "./static/nested", outputPath: "./test" },
    "_site",
    "test/stubs"
  );
  t.assert.strictEqual(pass.outputPath, "./test");
  t.assert.strictEqual(await pass.getOutputPath(), "_site/test");
});

test("Glob pattern", async (t) => {
  const globResolvedPath = "./test/stubs/template-passthrough/static/test.js";
  let pass = await getTemplatePassthrough(
    {
      inputPath: "./test/stubs/template-passthrough/static/*.js",
      outputPath: "./directory/",
    },
    "_site",
    "test/stubs"
  );
  t.assert.strictEqual(pass.outputPath, "./directory/");
  t.assert.strictEqual(await pass.getOutputPath(globResolvedPath), "_site/directory/test.js");
});

test("Output paths match with different templatePassthrough methods", async (t) => {
  let pass1 = await getTemplatePassthrough(
    { inputPath: "./static/nested", outputPath: "./test" },
    "_site",
    "test/stubs"
  );

  let pass2 = await getTemplatePassthrough("avatar.png", "_site/test", ".");
  t.assert.strictEqual(await pass1.getOutputPathForGlobFile("avatar.png"), await pass2.getOutputPath());
});

test("File renamed", async t => {
  let pass = await getTemplatePassthrough(
    {
      inputPath: "./test/stubs/template-passthrough/static/test.js",
      outputPath: "./rename.js"
    },
    "_site",
    "test/stubs"
  );
  t.assert.ok(pass);
  t.assert.strictEqual(await pass.getOutputPath(), "_site/rename.js");
});

test("Bug with incremental file copying to a directory output, issue #2278 #1038", async (t) => {
  let pass1 = await getTemplatePassthrough(
    { inputPath: "./test/stubs/public/test.css", outputPath: "/" },
    "test/stubs",
    "."
  );

  t.assert.strictEqual(await pass1.getOutputPath(), "test/stubs/test.css");
});

test("Bug with incremental dir copying to a directory output, issue #2278 #1038", async (t) => {
  let pass1 = await getTemplatePassthrough(
    { inputPath: "./test/stubs/public/", outputPath: "/" },
    "test/stubs",
    "."
  );

  t.assert.strictEqual(await pass1.getOutputPath(), "./test/stubs/");
});
