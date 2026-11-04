import test from "node:test";

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

  t.assert.strictEqual(c.length, 3);
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
  t.assert.strictEqual(posts.length, 3);
  t.assert.deepStrictEqual(posts[0].template, tmpl4);
  t.assert.deepStrictEqual(posts[1].template, tmpl1);
  t.assert.deepStrictEqual(posts[2].template, tmpl5);
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
  t.assert.strictEqual(posts.length, 3);
  t.assert.deepStrictEqual(posts[0].template, tmpl4);
  t.assert.deepStrictEqual(posts[1].template, tmpl1);
  t.assert.deepStrictEqual(posts[2].template, tmpl5);
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
  t.assert.strictEqual(posts.length, 2);
  t.assert.deepStrictEqual(posts[0].template, tmpl1);
  t.assert.deepStrictEqual(posts[1].template, tmpl3);

  let cats = c.getFilteredByTag("cat");
  t.assert.strictEqual(cats.length, 2);
  t.assert.deepStrictEqual(cats[0].template, tmpl2);
  t.assert.deepStrictEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTag("dog");
  t.assert.strictEqual(dogs.length, 1);
  t.assert.deepStrictEqual(dogs[0].template, tmpl1);
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
  t.assert.strictEqual(posts.length, 2);
  t.assert.deepStrictEqual(posts[0].template, tmpl1);
  t.assert.deepStrictEqual(posts[1].template, tmpl3);

  let cats = c.getFilteredByTag("cat");
  t.assert.ok(cats.length);
  t.assert.strictEqual(cats.length, 2);
  t.assert.deepStrictEqual(cats[0].template, tmpl2);
  t.assert.deepStrictEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTag("dog");
  t.assert.ok(dogs.length);
  t.assert.deepStrictEqual(dogs[0].template, tmpl1);
});

test("getFilteredByTag (results are cached, cache is invalidated by add)", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl2 = await getNewTemplateByNumber(2, $config);
  let tmpl3 = await getNewTemplateByNumber(3, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);

  let posts = c.getFilteredByTag("post");
  t.assert.strictEqual(posts.length, 1);

  await addTemplate(c, tmpl2);
  await addTemplate(c, tmpl3);

  t.assert.strictEqual(c.getFilteredByTag("post").length, 2);
  t.assert.strictEqual(c.getFilteredByTag("cat").length, 2);
  t.assert.strictEqual(c.getFilteredByTags("post", "cat").length, 1);
  t.assert.strictEqual(c.getAllSorted().length, 3);

  // The result returned before the additions is unaffected
  t.assert.strictEqual(posts.length, 1);
});

test("getFilteredByTag (results are mutable copies)", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl3 = await getNewTemplateByNumber(3, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl3);

  let posts = c.getFilteredByTag("post");
  posts.reverse();
  posts.pop();

  let posts2 = c.getFilteredByTag("post");
  t.assert.strictEqual(posts2.length, 2);
  t.assert.deepStrictEqual(posts2[0].template, tmpl1);
  t.assert.deepStrictEqual(posts2[1].template, tmpl3);

  let postsPlural = c.getFilteredByTags("post");
  postsPlural.pop();
  t.assert.strictEqual(c.getFilteredByTags("post").length, 2);
});

test("getFilteredByTag (no tag name returns everything, sorted)", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl4 = await getNewTemplateByNumber(4, $config);
  let tmpl5 = await getNewTemplateByNumber(5, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl4);
  await addTemplate(c, tmpl5);

  let all = c.getFilteredByTag();
  t.assert.strictEqual(all.length, 3);
  t.assert.deepStrictEqual(all[0].template, tmpl4);
  t.assert.deepStrictEqual(all[1].template, tmpl1);
  t.assert.deepStrictEqual(all[2].template, tmpl5);

  // `all` is not a tag name, it is filtered out of the included tag names
  t.assert.strictEqual(c.getFilteredByTag("all").length, 0);
  t.assert.strictEqual(c.getFilteredByTag("unknown-tag").length, 0);
  t.assert.strictEqual(c.getFilteredByTags().length, 3);
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
  t.assert.strictEqual(postsAndCats.length, 1);
  t.assert.deepStrictEqual(postsAndCats[0].template, tmpl3);

  let cats = c.getFilteredByTags("cat");
  t.assert.strictEqual(cats.length, 2);
  t.assert.deepStrictEqual(cats[0].template, tmpl2);
  t.assert.deepStrictEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTags("dog");
  t.assert.strictEqual(dogs.length, 1);
  t.assert.deepStrictEqual(dogs[0].template, tmpl1);
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
  t.assert.ok(postsAndCats.length);
  t.assert.strictEqual(postsAndCats.length, 1);
  t.assert.deepStrictEqual(postsAndCats[0].template, tmpl3);

  let cats = c.getFilteredByTags("cat");
  t.assert.ok(cats.length);
  t.assert.strictEqual(cats.length, 2);
  t.assert.deepStrictEqual(cats[0].template, tmpl2);
  t.assert.deepStrictEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTags("dog");
  t.assert.ok(dogs.length);
  t.assert.strictEqual(dogs.length, 1);
  t.assert.deepStrictEqual(dogs[0].template, tmpl1);
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
  t.assert.strictEqual(markdowns.length, 1);
  t.assert.deepStrictEqual(markdowns[0].template, tmpl1);
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
  t.assert.strictEqual(markdowns.length, 1);
  t.assert.deepStrictEqual(markdowns[0].template, tmpl1);

  let htmls = c.getFilteredByGlob("**/*.{html,njk}");
  t.assert.strictEqual(htmls.length, 2);
  t.assert.deepStrictEqual(htmls[0].template, tmpl6);
  t.assert.deepStrictEqual(htmls[1].template, tmpl7);
});

test("getFilteredByGlob (cache is invalidated by add)", async (t) => {
  let $config = await getTemplateConfigInstance();

  let tmpl1 = await getNewTemplateByNumber(1, $config);
  let tmpl6 = await getNewTemplateByNumber(6, $config);
  let tmpl8 = await getNewTemplateByNumber(8, $config);

  let c = new Collection();
  await addTemplate(c, tmpl1);
  await addTemplate(c, tmpl6);

  let markdowns = c.getFilteredByGlob("./**/*.md");
  t.assert.strictEqual(markdowns.length, 1);

  await addTemplate(c, tmpl8);
  t.assert.strictEqual(c.getFilteredByGlob("./**/*.md").length, 2);

  // The result returned before the addition is unaffected
  t.assert.strictEqual(markdowns.length, 1);
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
  t.assert.strictEqual(posts.length, 1);
});

// Swapped to `micromatch` in 3.0.0-alpha.17, and later to `picomatch`.
// The test can stay as a sanity check.
test("micromatch assumptions, issue #127", async (t) => {
  function isMatch(filepath, globs) {
    return isGlobMatch(filepath, globs);
  }
  t.assert.strictEqual(isMatch("src/bookmarks/test.md", ["**/+(bookmarks|posts|screencasts)/**/!(index)*.md"]), true);

  t.assert.strictEqual(isMatch("./src/bookmarks/test.md", ["./**/+(bookmarks|posts|screencasts)/**/!(index)*.md"]), true);

  let c = new Collection();
  let globs = c.getGlobs("**/+(bookmarks|posts|screencasts)/**/!(index)*.md");
  t.assert.deepStrictEqual(globs, ["./**/+(bookmarks|posts|screencasts)/**/!(index)*.md"]);

  t.assert.strictEqual(isMatch("./src/bookmarks/test.md", globs), true);
  t.assert.strictEqual(isMatch("./src/bookmarks/index.md", globs), false);
  t.assert.strictEqual(isMatch("./src/bookmarks/index2.md", globs), false);
  t.assert.strictEqual(isMatch("./src/_content/bookmarks/2018-03-27-git-message.md", globs), true);
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
  t.assert.strictEqual(posts.length, 3);
  t.assert.deepStrictEqual(posts[0].template, tmpl4);
  t.assert.deepStrictEqual(posts[1].template, tmpl1);
  t.assert.deepStrictEqual(posts[2].template, tmpl5);

  let posts2 = c.getAllSorted().reverse();
  t.assert.strictEqual(posts2.length, 3);
  t.assert.deepStrictEqual(posts2[0].template, tmpl5);
  t.assert.deepStrictEqual(posts2[1].template, tmpl1);
  t.assert.deepStrictEqual(posts2[2].template, tmpl4);

  let posts3 = c.getAllSorted().reverse();
  t.assert.strictEqual(posts3.length, 3);
  t.assert.deepStrictEqual(posts3[0].template, tmpl5);
  t.assert.deepStrictEqual(posts3[1].template, tmpl1);
  t.assert.deepStrictEqual(posts3[2].template, tmpl4);
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
  t.assert.strictEqual(posts.length, 0);

  let offices = c.getFilteredByTag("office");
  offices.sort(Sortable.sortFunctionDate);

  t.assert.strictEqual(offices.length, 2);
  t.assert.deepStrictEqual(offices[0].template, tmpl10);
  t.assert.deepStrictEqual(offices[1].template, tmpl9);
});
