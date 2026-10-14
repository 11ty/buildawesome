import test from "ava";

import TemplateFileSlug from "../src/TemplateFileSlug.js";
import ExtensionMap from "../src/ExtensionMap.js";

import { getTemplateConfigInstance } from "./_testHelpers.js";

async function getNewSlugInstance(path, inputDir) {
  let eleventyConfig = await getTemplateConfigInstance({
    dir: {
      input: inputDir
    }
  });

  let extensionMap = new ExtensionMap(eleventyConfig);
  extensionMap.setFormats([]);
  let fs = new TemplateFileSlug(path, extensionMap, eleventyConfig);
  return fs;
}

test("Easy slug", async (t) => {
  let fs = await getNewSlugInstance("./file.html");
  t.is(fs.getSlug(), "file");
  t.is(fs.getFullPathWithoutExtension(), "/file");
});

test("Easy slug with dot", async (t) => {
  let fs = await getNewSlugInstance("./file.test.html");
  t.is(fs.getSlug(), "file.test");
  t.is(fs.getFullPathWithoutExtension(), "/file.test");
});

test("Easy slug with dot 11ty.js", async (t) => {
  let fs = await getNewSlugInstance("./file.test.11ty.js");
  t.is(fs.getSlug(), "file.test");
  t.is(fs.getFullPathWithoutExtension(), "/file.test");
});

test("Easy slug with date", async (t) => {
  let fs = await getNewSlugInstance("./2018-01-01-file.html");
  t.is(fs.getSlug(), "file");
  t.is(fs.getFullPathWithoutExtension(), "/file");
});

test("Easy slug with date and dot in slug", async (t) => {
  let fs = await getNewSlugInstance("./2018-01-01-file.test.html");
  t.is(fs.getSlug(), "file.test");
  t.is(fs.getFullPathWithoutExtension(), "/file.test");
});

test("Easy slug, index", async (t) => {
  let fs = await getNewSlugInstance("./index.html");
  t.is(fs.getSlug(), "");
  t.is(fs.getFullPathWithoutExtension(), "/index");
});

test("Easy slug with date, index", async (t) => {
  let fs = await getNewSlugInstance("./2018-01-01-index.html");
  t.is(fs.getSlug(), "");
  t.is(fs.getFullPathWithoutExtension(), "/index");
});

test("Easy slug with only a date and no suffix", async (t) => {
  let fs = await getNewSlugInstance("./2018-01-01.html");
  t.is(fs.getSlug(), "2018-01-01");
  t.is(fs.getFullPathWithoutExtension(), "/2018-01-01");
});

/* Directories */

test("Easy slug with dir", async (t) => {
  let fs = await getNewSlugInstance("./test/file.html");
  t.is(fs.getSlug(), "file");
  t.is(fs.getFullPathWithoutExtension(), "/test/file");
});

test("Easy slug with dot with dir", async (t) => {
  let fs = await getNewSlugInstance("./test/file.test.html");
  t.is(fs.getSlug(), "file.test");
  t.is(fs.getFullPathWithoutExtension(), "/test/file.test");
});

test("Easy slug with date with dir", async (t) => {
  let fs = await getNewSlugInstance("./test/2018-01-01-file.html");
  t.is(fs.getSlug(), "file");
  t.is(fs.getFullPathWithoutExtension(), "/test/file");
});

test("Easy slug with date and dot in slug with dir", async (t) => {
  let fs = await getNewSlugInstance("./test/2018-01-01-file.test.html");
  t.is(fs.getSlug(), "file.test");
  t.is(fs.getFullPathWithoutExtension(), "/test/file.test");
});

test("Easy slug, index with dir", async (t) => {
  let fs = await getNewSlugInstance("./test/index.html");
  t.is(fs.getSlug(), "test");
  t.is(fs.getFullPathWithoutExtension(), "/test/index");
});

test("Easy slug with date, index with dir", async (t) => {
  let fs = await getNewSlugInstance("./test/2018-01-01-index.html");
  t.is(fs.getSlug(), "test");
  t.is(fs.getFullPathWithoutExtension(), "/test/index");
});

test("Strips date from dir name", async (t) => {
  let fs = await getNewSlugInstance("./2021-11-20-my-awesome-post/index.md");
  t.is(fs.getSlug(), "my-awesome-post");
  t.is(fs.getFullPathWithoutExtension(), "/2021-11-20-my-awesome-post/index");
});

/* Pass Input dir */
test("Easy slug, input dir", async (t) => {
  let fs = await getNewSlugInstance("./file.html", ".");
  t.is(fs.getSlug(), "file");
  t.is(fs.getFullPathWithoutExtension(), "/file");
});

test("Easy slug with dot, input dir", async (t) => {
  let fs = await getNewSlugInstance("./file.test.html", ".");
  t.is(fs.getSlug(), "file.test");
  t.is(fs.getFullPathWithoutExtension(), "/file.test");
});

test("Easy slug with date, input dir", async (t) => {
  let fs = await getNewSlugInstance("./2018-01-01-file.html", ".");
  t.is(fs.getSlug(), "file");
  t.is(fs.getFullPathWithoutExtension(), "/file");
});

test("Easy slug with date and dot in slug, input dir", async (t) => {
  let fs = await getNewSlugInstance("./2018-01-01-file.test.html", ".");
  t.is(fs.getSlug(), "file.test");
  t.is(fs.getFullPathWithoutExtension(), "/file.test");
});

test("Easy slug, index, input dir", async (t) => {
  let fs = await getNewSlugInstance("./index.html", ".");
  t.is(fs.getSlug(), "");
  t.is(fs.getFullPathWithoutExtension(), "/index");
});

test("Easy slug with date, index, input dir", async (t) => {
  let fs = await getNewSlugInstance("./2018-01-01-index.html", ".");
  t.is(fs.getSlug(), "");
  t.is(fs.getFullPathWithoutExtension(), "/index");
});

/* Directories and Input Dir */

test("Easy slug with dir and input dir", async (t) => {
  let fs = await getNewSlugInstance("./test/file.html", "./test");
  t.is(fs.getSlug(), "file");
  t.is(fs.getFullPathWithoutExtension(), "/file");
});

test("Easy slug with dot with dir and input dir", async (t) => {
  let fs = await getNewSlugInstance("./test/file.test.html", "./test");
  t.is(fs.getSlug(), "file.test");
  t.is(fs.getFullPathWithoutExtension(), "/file.test");
});

test("Easy slug with date with dir and input dir", async (t) => {
  let fs = await getNewSlugInstance("./test/2018-01-01-file.html", "./test");
  t.is(fs.getSlug(), "file");
  t.is(fs.getFullPathWithoutExtension(), "/file");
});

test("Easy slug with date and dot in slug with dir and input dir", async (t) => {
  let fs = await getNewSlugInstance("./test/2018-01-01-file.test.html", "./test");
  t.is(fs.getSlug(), "file.test");
  t.is(fs.getFullPathWithoutExtension(), "/file.test");
});

test("Easy slug, index with dir and input dir", async (t) => {
  let fs = await getNewSlugInstance("./test/index.html", "./test");
  t.is(fs.getSlug(), "");
  t.is(fs.getFullPathWithoutExtension(), "/index");
});

test("Easy slug with date, index with dir and input dir", async (t) => {
  let fs = await getNewSlugInstance("./test/2018-01-01-index.html", "./test");
  t.is(fs.getSlug(), "");
  t.is(fs.getFullPathWithoutExtension(), "/index");
});

test("Easy slug with multiple dirs", async (t) => {
  let fs = await getNewSlugInstance("./dir1/dir2/dir3/file.html", ".");
  t.is(fs.getSlug(), "file");
  t.is(fs.getFullPathWithoutExtension(), "/dir1/dir2/dir3/file");
});

test("Easy slug with multiple dirs and an index file", async (t) => {
  let fs = await getNewSlugInstance("./dir1/dir2/dir3/index.html", ".");
  t.is(fs.getSlug(), "dir3");
  t.is(fs.getFullPathWithoutExtension(), "/dir1/dir2/dir3/index");
});
