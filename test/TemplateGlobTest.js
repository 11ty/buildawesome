import test from "node:test";
import { glob } from 'tinyglobby';
import { TemplatePath } from "@11ty/eleventy-utils";

import TemplateGlob from "../src/TemplateGlob.js";

test("TemplatePath assumptions", (t) => {
  t.assert.strictEqual(TemplatePath.normalize("ignoredFolder"), "ignoredFolder");
  t.assert.strictEqual(TemplatePath.normalize("./ignoredFolder"), "ignoredFolder");
  t.assert.strictEqual(TemplatePath.normalize("./ignoredFolder/"), "ignoredFolder");
});

test("Normalize string argument", (t) => {
  t.assert.deepStrictEqual(TemplateGlob.map("views"), "./views");
  t.assert.deepStrictEqual(TemplateGlob.map("views/"), "./views");
  t.assert.deepStrictEqual(TemplateGlob.map("./views"), "./views");
  t.assert.deepStrictEqual(TemplateGlob.map("./views/"), "./views");
});

test("Normalize with nots", (t) => {
  t.assert.deepStrictEqual(TemplateGlob.map("!views"), "!./views");
  t.assert.deepStrictEqual(TemplateGlob.map("!views/"), "!./views");
  t.assert.deepStrictEqual(TemplateGlob.map("!./views"), "!./views");
  t.assert.deepStrictEqual(TemplateGlob.map("!./views/"), "!./views");
});

test("Normalize with globstar", (t) => {
  t.assert.deepStrictEqual(TemplateGlob.map("!views/**"), "!./views/**");
  t.assert.deepStrictEqual(TemplateGlob.map("!./views/**"), "!./views/**");
});

test("Normalize with globstar and star", (t) => {
  t.assert.deepStrictEqual(TemplateGlob.map("!views/**/*"), "!./views/**/*");
  t.assert.deepStrictEqual(TemplateGlob.map("!./views/**/*"), "!./views/**/*");
});

test("Normalize with globstar and star and file extension", (t) => {
  t.assert.deepStrictEqual(TemplateGlob.map("!views/**/*.json"), "!./views/**/*.json");
  t.assert.deepStrictEqual(TemplateGlob.map("!./views/**/*.json"), "!./views/**/*.json");
});

test("NormalizePath with globstar and star and file extension", (t) => {
  t.assert.deepStrictEqual(TemplateGlob.normalizePath("views", "/", "**/*.json"), "./views/**/*.json");
  t.assert.deepStrictEqual(TemplateGlob.normalizePath("./views", "/", "**/*.json"), "./views/**/*.json");
});

test("NormalizePath with globstar and star and file extension (errors)", (t) => {
  t.assert.throws(() => {
    TemplateGlob.normalizePath("!views/**/*.json");
  });

  t.assert.throws(() => {
    TemplateGlob.normalizePath("!views", "/", "**/*.json");
  });

  t.assert.throws(() => {
    TemplateGlob.normalizePath("!./views/**/*.json");
  });

  t.assert.throws(() => {
    TemplateGlob.normalizePath("!./views", "/", "**/*.json");
  });
});

test("Normalize array argument", (t) => {
  t.assert.deepStrictEqual(TemplateGlob.map(["views", "content"]), ["./views", "./content"]);
  t.assert.deepStrictEqual(TemplateGlob.map("views/"), "./views");
  t.assert.deepStrictEqual(TemplateGlob.map("./views"), "./views");
  t.assert.deepStrictEqual(TemplateGlob.map("./views/"), "./views");
});

test("matuzo project issue with fastglob assumptions", async (t) => {
  let dotslashincludes = await glob(
    TemplateGlob.map([
      "./test/stubs/globby/**/*.html",
      "!./test/stubs/globby/_includes/**/*",
      "!./test/stubs/globby/_data/**/*",
    ])
  );

  t.assert.strictEqual(
    dotslashincludes.filter(function (file) {
      return file.indexOf("_includes") > -1;
    }).length,
    0
  );

  let globincludes = await glob(
    TemplateGlob.map([
      "test/stubs/globby/**/*.html",
      "!./test/stubs/globby/_includes/**/*",
      "!./test/stubs/globby/_data/**/*",
    ])
  );
  t.assert.strictEqual(
    globincludes.filter(function (file) {
      return file.indexOf("_includes") > -1;
    }).length,
    0
  );
});

// `fast-glob` isn't used any more, but the test can stay as a sanity check.
test("fastglob assumptions", async (t) => {
  let globbed = await glob("test/stubs/ignoredFolder/**");
  t.assert.strictEqual(globbed.length, 1);

  let globbed2 = await glob("test/stubs/ignoredFolder/**/*");
  t.assert.strictEqual(globbed2.length, 1);

  let globbed3 = await glob([
    "./test/stubs/ignoredFolder/**/*.md",
    "!./test/stubs/ignoredFolder/**",
  ]);
  t.assert.strictEqual(globbed3.length, 0);

  let globbed4 = await glob(["./test/stubs/ignoredFolder/*.md", "!./test/stubs/ignoredFolder/**"]);
  t.assert.strictEqual(globbed4.length, 0);

  let globbed5 = await glob([
    "./test/stubs/ignoredFolder/ignored.md",
    "!./test/stubs/ignoredFolder/**",
  ]);
  t.assert.strictEqual(globbed5.length, 0);
});
