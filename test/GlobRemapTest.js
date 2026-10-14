import test from "ava";
import path from "node:path";
import GlobRemap from "../src/Util/GlobRemap.js";
import { normalizeSeparatorString } from "./Util/normalizeSeparators.js";

test("getParentDirPrefix", (t) => {
  t.is(GlobRemap.getParentDirPrefix(""), "");
  t.is(GlobRemap.getParentDirPrefix("./test/"), "");
  t.is(GlobRemap.getParentDirPrefix("../test/"), "../");
  t.is(GlobRemap.getParentDirPrefix("../test/../"), "../");
  t.is(GlobRemap.getParentDirPrefix("../../test/"), "../../");
});

test("getCwd", (t) => {
  t.is(GlobRemap.getCwd([]), "");
  t.is(GlobRemap.getCwd(["test.njk"]), "");
  t.is(GlobRemap.getCwd(["./test.njk"]), "");
  t.is(GlobRemap.getCwd(["../test.njk"]), "../");
  t.is(GlobRemap.getCwd(["../test.njk", "../../2.njk"]), "../../");
});

test("Constructor (control)", t => {
  let m = new GlobRemap([
    '**/*.{liquid,md,njk,html,11ty.js,11ty.cjs,11ty.mjs}',
    '**/*.txt', // passthrough copy
    '**/*.png',
    '_includes/**',
    '_data/**',
    '.gitignore',
    '.eleventyignore',
    'eleventy.config.js',
  ])

  t.deepEqual(m.getInput(), [
    '**/*.{liquid,md,njk,html,11ty.js,11ty.cjs,11ty.mjs}',
    '**/*.txt', // passthrough copy
    '**/*.png',
    '_includes/**',
    '_data/**',
    '.gitignore',
    '.eleventyignore',
    'eleventy.config.js',
  ])
});

test("Constructor (control with ./)", t => {
  let m = new GlobRemap([
    './**/*.{liquid,md,njk,html,11ty.js,11ty.cjs,11ty.mjs}',
    './**/*.txt', // passthrough copy
    './**/*.png',
    './_includes/**',
    './_data/**',
    './.gitignore',
    './.eleventyignore',
    './eleventy.config.js',
  ])

  t.deepEqual(m.getInput(), [
    './**/*.{liquid,md,njk,html,11ty.js,11ty.cjs,11ty.mjs}',
    './**/*.txt', // passthrough copy
    './**/*.png',
    './_includes/**',
    './_data/**',
    './.gitignore',
    './.eleventyignore',
    './eleventy.config.js',
  ])
});

test("Constructor (up one dir)", t => {
  let m = new GlobRemap([
    '../**/*.{liquid,md,njk,html,11ty.js,11ty.cjs,11ty.mjs}',
    '../**/*.txt', // passthrough copy
    '../**/*.png',
    '../_includes/**',
    '../_data/**',
    './.gitignore',
    './.eleventyignore',
    '../.eleventyignore',
    './eleventy.config.js',
  ])

  let parentDir = normalizeSeparatorString(path.resolve("./").split(path.sep).slice(-1).join(path.sep));

  t.deepEqual(m.getInput(), [
    '**/*.{liquid,md,njk,html,11ty.js,11ty.cjs,11ty.mjs}',
    '**/*.txt', // passthrough copy
    '**/*.png',
    '_includes/**',
    '_data/**',
    `${parentDir}/.gitignore`,
    `${parentDir}/.eleventyignore`,
    '.eleventyignore',
    `${parentDir}/eleventy.config.js`,
  ])
});

test("Constructor (up two dirs)", t => {
  let m = new GlobRemap([
    '../../**/*.{liquid,md,njk,html,11ty.js,11ty.cjs,11ty.mjs}',
    '../**/*.txt', // passthrough copy
    '../**/*.png',
    '../_includes/**',
    '../_data/**',
    './.gitignore',
    './.eleventyignore',
    '../.eleventyignore',
    './eleventy.config.js',
  ])

  let childDir = normalizeSeparatorString(path.resolve("./").split(path.sep).slice(-2).join(path.sep));
  let parentDir = normalizeSeparatorString(path.resolve("./").split(path.sep).slice(-2, -1).join(path.sep));

  t.deepEqual(m.getInput(), [
    '**/*.{liquid,md,njk,html,11ty.js,11ty.cjs,11ty.mjs}',
    `${parentDir}/**/*.txt`, // passthrough copy
    `${parentDir}/**/*.png`,
    `${parentDir}/_includes/**`,
    `${parentDir}/_data/**`,
    `${childDir}/.gitignore`,
    `${childDir}/.eleventyignore`,
    `${parentDir}/.eleventyignore`,
    `${childDir}/eleventy.config.js`,
  ])
});
