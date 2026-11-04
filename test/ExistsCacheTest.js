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
  t.assert.strictEqual(cache.lookupCount, 1);

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
