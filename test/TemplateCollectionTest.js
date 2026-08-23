import test from "ava";

import { isGlobMatch } from "../src/Util/GlobMatcher.js";
import Collection from "../src/TemplateCollection.js";
import Sortable from "../src/Util/Objects/Sortable.js";

import getNewTemplateForTests from "../test/_getNewTemplateForTests.js";
import { getTemplateConfigInstance } from "./_testHelpers.js";

function getNewTemplate(filename, input, output, $config) {
  return getNewTemplateForTests(filename, input, output, null, null, $config);
}

function getNewTemplateByNumber(num, $config) {
  let extensions = ["md", "md", "md", "md", "md", "html", "njk", "md", "md", "md"];

  return getNewTemplateForTests(
    `./test/stubs/collection/test${num}.${extensions[num - 1]}`,
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    $config,
  );
}

async function addTemplate(collection, template) {
  let data = await template.getData();
  for (let map of await template.getTemplates(data)) {
    collection.add(map);
  }
}

test("Basic setup", async (t) => {
	let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl2 = await getNewTemplateByNumber(2, $config);
  let tmpl3 = await getNewTemplateByNumber(3, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl2);
  await addTemplate(c, tmpl3);

  t.is(c.length, 3);
});

test("sortFunctionDate", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl4 = await getNewTemplateByNumber(4, $config);
  let tmpl5 = await getNewTemplateByNumber(5, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl4);
  await addTemplate(c, tmpl5);

  let posts = c.sort(Sortable.sortFunctionDate);
  t.is(posts.length, 3);
  t.deepEqual(posts[0].template, tmpl4);
  t.deepEqual(posts[1].template, tmpl1);
  t.deepEqual(posts[2].template, tmpl5);
});

test("sortFunctionDateInputPath", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl4 = await getNewTemplateByNumber(4, $config);
  let tmpl5 = await getNewTemplateByNumber(5, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl4);
  await addTemplate(c, tmpl5);

  let posts = c.sort(Sortable.sortFunctionDateInputPath);
  t.is(posts.length, 3);
  t.deepEqual(posts[0].template, tmpl4);
  t.deepEqual(posts[1].template, tmpl1);
  t.deepEqual(posts[2].template, tmpl5);
});

test("getFilteredByTag", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl2 = await getNewTemplateByNumber(2, $config);
  let tmpl3 = await getNewTemplateByNumber(3, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl2);
  await addTemplate(c, tmpl3);

  let posts = c.getFilteredByTag("post");
  t.is(posts.length, 2);
  t.deepEqual(posts[0].template, tmpl1);
  t.deepEqual(posts[1].template, tmpl3);

  let cats = c.getFilteredByTag("cat");
  t.is(cats.length, 2);
  t.deepEqual(cats[0].template, tmpl2);
  t.deepEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTag("dog");
  t.is(dogs.length, 1);
  t.deepEqual(dogs[0].template, tmpl1);
});

test("getFilteredByTag (added out of order, sorted)", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl2 = await getNewTemplateByNumber(2, $config);
  let tmpl3 = await getNewTemplateByNumber(3, $config);

  let c = new Collection();
  await addTemplate(c, tmpl3);
  await addTemplate(c, tmpl2);
  await addTemplate(c, tmpl1);

  let posts = c.getFilteredByTag("post");
  t.is(posts.length, 2);
  t.deepEqual(posts[0].template, tmpl1);
  t.deepEqual(posts[1].template, tmpl3);

  let cats = c.getFilteredByTag("cat");
  t.truthy(cats.length);
  t.is(cats.length, 2);
  t.deepEqual(cats[0].template, tmpl2);
  t.deepEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTag("dog");
  t.truthy(dogs.length);
  t.deepEqual(dogs[0].template, tmpl1);
});

test("getFilteredByTags", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl2 = await getNewTemplateByNumber(2, $config);
  let tmpl3 = await getNewTemplateByNumber(3, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl2);
  await addTemplate(c, tmpl3);

  let postsAndCats = c.getFilteredByTags("post", "cat");
  t.is(postsAndCats.length, 1);
  t.deepEqual(postsAndCats[0].template, tmpl3);

  let cats = c.getFilteredByTags("cat");
  t.is(cats.length, 2);
  t.deepEqual(cats[0].template, tmpl2);
  t.deepEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTags("dog");
  t.is(dogs.length, 1);
  t.deepEqual(dogs[0].template, tmpl1);
});

test("getFilteredByTags (added out of order, sorted)", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl2 = await getNewTemplateByNumber(2, $config);
  let tmpl3 = await getNewTemplateByNumber(3, $config);

  let c = new Collection();
  await addTemplate(c, tmpl3);
  await addTemplate(c, tmpl2);
  await addTemplate(c, tmpl1);

  let postsAndCats = c.getFilteredByTags("post", "cat");
  t.truthy(postsAndCats.length);
  t.is(postsAndCats.length, 1);
  t.deepEqual(postsAndCats[0].template, tmpl3);

  let cats = c.getFilteredByTags("cat");
  t.truthy(cats.length);
  t.is(cats.length, 2);
  t.deepEqual(cats[0].template, tmpl2);
  t.deepEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTags("dog");
  t.truthy(dogs.length);
  t.is(dogs.length, 1);
  t.deepEqual(dogs[0].template, tmpl1);
});

test("getFilteredByGlob", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl6 = await getNewTemplateByNumber(6, $config);
  let tmpl7 = await getNewTemplateByNumber(7, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl6);
  await addTemplate(c, tmpl7);

  let markdowns = c.getFilteredByGlob("./**/*.md");
  t.is(markdowns.length, 1);
  t.deepEqual(markdowns[0].template, tmpl1);
});

test("getFilteredByGlob no dash dot", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl6 = await getNewTemplateByNumber(6, $config);
  let tmpl7 = await getNewTemplateByNumber(7, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl6);
  await addTemplate(c, tmpl7);

  let markdowns = c.getFilteredByGlob("**/*.md");
  t.is(markdowns.length, 1);
  t.deepEqual(markdowns[0].template, tmpl1);

  let htmls = c.getFilteredByGlob("**/*.{html,njk}");
  t.is(htmls.length, 2);
  t.deepEqual(htmls[0].template, tmpl6);
  t.deepEqual(htmls[1].template, tmpl7);
});

test("partial match on tag string, issue 95", async (t) => {
  let $config = await getTemplateConfigInstance();

  let cat = await getNewTemplate(
    "./test/stubs/issue-95/cat.md",
    "./test/stubs/",
    "./test/stubs/_site",
    $config,
  );
  let notacat = await getNewTemplate(
    "./test/stubs/issue-95/notacat.md",
    "./test/stubs/",
    "./test/stubs/_site",
    $config,
  );

  let c = new Collection();
  await addTemplate(c, cat);
  await addTemplate(c, notacat);

  let posts = c.getFilteredByTag("cat");
  t.is(posts.length, 1);
});

// Swapped to `micromatch` in 3.0.0-alpha.17, and later to `picomatch`.
// The test can stay as a sanity check.
test("micromatch assumptions, issue #127", async (t) => {
  function isMatch(filepath, globs) {
    return isGlobMatch(filepath, globs);
  }
  t.true(
    isMatch("src/bookmarks/test.md", ["**/+(bookmarks|posts|screencasts)/**/!(index)*.md"]),
  );

  t.true(
    isMatch("./src/bookmarks/test.md", ["./**/+(bookmarks|posts|screencasts)/**/!(index)*.md"]),
  );

  let c = new Collection();
  let globs = c.getGlobs("**/+(bookmarks|posts|screencasts)/**/!(index)*.md");
  t.deepEqual(globs, ["./**/+(bookmarks|posts|screencasts)/**/!(index)*.md"]);

  t.true(isMatch("./src/bookmarks/test.md", globs));
  t.false(isMatch("./src/bookmarks/index.md", globs));
  t.false(isMatch("./src/bookmarks/index2.md", globs));
  t.true(isMatch("./src/_content/bookmarks/2018-03-27-git-message.md", globs));
});

test("Sort in place (issue #352)", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl4 = await getNewTemplateByNumber(4, $config);
  let tmpl5 = await getNewTemplateByNumber(5, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl4);
  await addTemplate(c, tmpl5);

  let posts = c.getAllSorted();
  t.is(posts.length, 3);
  t.deepEqual(posts[0].template, tmpl4);
  t.deepEqual(posts[1].template, tmpl1);
  t.deepEqual(posts[2].template, tmpl5);

  let posts2 = c.getAllSorted().reverse();
  t.is(posts2.length, 3);
  t.deepEqual(posts2[0].template, tmpl5);
  t.deepEqual(posts2[1].template, tmpl1);
  t.deepEqual(posts2[2].template, tmpl4);

  let posts3 = c.getAllSorted().reverse();
  t.is(posts3.length, 3);
  t.deepEqual(posts3[0].template, tmpl5);
  t.deepEqual(posts3[1].template, tmpl1);
  t.deepEqual(posts3[2].template, tmpl4);
});

test("getFilteredByTag with excludes", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl8 = await getNewTemplateByNumber(8, $config);
  let tmpl9 = await getNewTemplateByNumber(9, $config);
  let tmpl10 = await getNewTemplateByNumber(10, $config);

  let c = new Collection();
  await addTemplate(c, tmpl8);
  await addTemplate(c, tmpl9);
  await addTemplate(c, tmpl10);

  let posts = c.getFilteredByTag("post");
  t.is(posts.length, 0);

  let offices = c.getFilteredByTag("office");
  offices.sort(Sortable.sortFunctionDate);

  t.is(offices.length, 2);
  t.deepEqual(offices[0].template, tmpl10);
  t.deepEqual(offices[1].template, tmpl9);
});
