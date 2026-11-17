import test from "node:test";

import ExistsCache from "../src/Util/ExistsCache.js";

test("Simple check (with directory checking)", async t => {
  let cache = new ExistsCache();

  t.assert.strictEqual(cache.exists("test"), true);
  t.assert.strictEqual(cache.size, 1);
  t.assert.strictEqual(cache.lookupCount, 1);
  t.assert.strictEqual(cache.exists("test"), true);
  t.assert.strictEqual(cache.size, 1);
  t.assert.strictEqual(cache.lookupCount, 1);
  t.assert.strictEqual(cache.exists("test/stubs"), true);
  t.assert.strictEqual(cache.size, 2);
  t.assert.strictEqual(cache.lookupCount, 2);
  t.assert.strictEqual(cache.exists("test/stubs/does-not-exist-ever-hslkadjflk"), false);
  t.assert.strictEqual(cache.size, 3);
  t.assert.strictEqual(cache.lookupCount, 3);
});

test("Simple check (parent directory already invalidated)", async t => {
  let cache = new ExistsCache();

  t.assert.strictEqual(cache.exists("test/folder-does-not-exist-askdfjkladjs"), false);
  t.assert.strictEqual(cache.size, 1);
  t.assert.strictEqual(cache.lookupCount, 2);

	// we already know this *doesn’t* exist.
  t.assert.strictEqual(cache.exists("test/folder-does-not-exist-askdfjkladjs/file-we-already-know-does-not-exist.liquid"), false);
	t.assert.strictEqual(cache.size, 2);
  t.assert.strictEqual(cache.lookupCount, 2);
});

test("delete looks up the file again", t => {
  let cache = new ExistsCache();
  cache.set("./test/stubs/does-not-exist.md", true);
  t.assert.strictEqual(cache.exists("./test/stubs/does-not-exist.md"), true);

  cache.delete("test/stubs/does-not-exist.md");
  t.assert.strictEqual(cache.exists("./test/stubs/does-not-exist.md"), false);
});

test("resolve matches each path segment case-insensitively #4224", async t => {
  let cache = new ExistsCache();
  t.assert.strictEqual(cache.resolve("./test/_issues/4224/_includes/base.vZome"), "./test/_issues/4224/_includes/base.vZome");
  t.assert.strictEqual(cache.resolve("./test/_issues/4224/_includes/BASE.VZOME"), "./test/_issues/4224/_includes/base.vZome");
  t.assert.strictEqual(cache.resolve("./test/_issues/4224/_Includes/Partials/inner.VZOME"), "./test/_issues/4224/_includes/partials/inner.vZome");
  t.assert.strictEqual(cache.resolve("./test/_issues/4224/_includes/missing.vzome"), undefined);
  t.assert.strictEqual(cache.resolve("./test/_issues/missing-dir/base.vzome"), undefined);
});

test("exists matches every path segment exactly on every OS #4224", async t => {
  let cache = new ExistsCache();
  t.assert.strictEqual(cache.exists("./test/_issues/4224/_includes/base.vZome"), true);
  t.assert.strictEqual(cache.exists("./test/_issues/4224/_includes/BASE.VZOME"), false);
  t.assert.strictEqual(cache.exists("./test/_issues/4224/_Includes/base.vZome"), false);
  t.assert.strictEqual(cache.exists("./TEST/_issues/4224/_includes/"), false);
  t.assert.strictEqual(cache.exists("./test/_issues/4224/_includes/"), true);
  t.assert.strictEqual(cache.lookupCount, 5);
});

test("resolve throws on names that differ only by case #4224", async t => {
  let cache = new ExistsCache();
  cache.addListing("test/_issues/4224/_includes", ["base.vZome", "base.vzome"]);
  t.assert.strictEqual(cache.exists("./test/_issues/4224/_includes/base.vZome"), true);
  t.assert.throws(() => cache.resolve("./test/_issues/4224/_includes/base.vZome"), /differ only by case/);
});

test("addListing answers without reading the directory", async t => {
  let cache = new ExistsCache();
  cache.addListing("./test/stubs", ["a.txt"]);
  t.assert.strictEqual(cache.exists("test/stubs/a.txt"), true);
  t.assert.strictEqual(cache.exists("./test/stubs/b.txt"), false);
  // Only the ancestors are read
  t.assert.strictEqual(cache.lookupCount, 2);
});

test("delete forgets ancestor listings", async t => {
  let cache = new ExistsCache();
  cache.addListing(".", []);
  t.assert.strictEqual(cache.exists("test/stubs"), false);
  cache.delete("test/stubs/new.md");
  t.assert.strictEqual(cache.exists("./test/stubs"), true);
});
