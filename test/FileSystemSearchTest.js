import test from "node:test";
import path from "node:path";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import FileSystemSearch from "../src/FileSystemSearch.js";
import ExistsCache from "../src/Util/ExistsCache.js";

test("Base", async (t) => {
  let fs = new FileSystemSearch();
  t.assert.strictEqual(fs.count, 0);

  t.assert.deepStrictEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/file.txt",
  ]);
  t.assert.strictEqual(fs.count, 1);

  fs.add("./test/file-system-search/virtual-file.txt");
  t.assert.deepStrictEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/file.txt",
    "./test/file-system-search/virtual-file.txt",
  ]);
  t.assert.strictEqual(fs.count, 1);

  fs.add("./test/file-system-search/another-file.txt");
  t.assert.deepStrictEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/file.txt",
    "./test/file-system-search/virtual-file.txt",
    "./test/file-system-search/another-file.txt",
  ]);
  t.assert.strictEqual(fs.count, 1);

  // Delete
  fs.delete("./test/file-system-search/file.txt");
  t.assert.deepStrictEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/virtual-file.txt",
    "./test/file-system-search/another-file.txt",
  ]);
  t.assert.strictEqual(fs.count, 1);

  fs.delete("./test/file-system-search/another-file.txt");
  t.assert.deepStrictEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/virtual-file.txt",
  ]);
  t.assert.strictEqual(fs.count, 1);

  fs.delete("./test/file-system-search/virtual-file.txt");
  t.assert.deepStrictEqual(await fs.search("key", "./test/file-system-search/*.txt"), []);
  t.assert.strictEqual(fs.count, 1);
});

// Backslashes are only path separators on Windows
const windowsTest = path.sep === "\\" ? test : test.skip;

windowsTest("New files with Windows paths are added to the cache", async (t) => {
  let fs = new FileSystemSearch();

  // Initial search using forward slashes
  await fs.search("windows-path-test", "./test/file-system-search/*.txt");

  // Simulate a Windows file watcher returning backslashes
  fs.add("test\\file-system-search\\windows-new-file.txt");

  // The newly added file should appear in the cache
  let results = await fs.search(
    "windows-path-test",
    "./test/file-system-search/*.txt"
  );

  t.assert.strictEqual(results.includes("./test/file-system-search/windows-new-file.txt"), true);
});

test("Added paths use platform separators (backslashes on Windows)", async (t) => {
  let fs = new FileSystemSearch();
  await fs.search("key", "./test/file-system-search/*.txt");

  fs.add(path.join("test", "file-system-search", "native-file.txt"));
  t.assert.deepStrictEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/file.txt",
    "./test/file-system-search/native-file.txt",
  ]);

  fs.delete(path.join(".", "test", "file-system-search", "file.txt"));
  t.assert.deepStrictEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/native-file.txt",
  ]);
});

test("Modifications during an in-flight search are applied", async (t) => {
  let fs = new FileSystemSearch();
  let pending = fs.search("key", "./test/file-system-search/*.txt");

  fs.add("./test/file-system-search/virtual-file.txt");
  fs.delete("./test/file-system-search/file.txt");

  t.assert.deepStrictEqual(await pending, [
    "./test/file-system-search/virtual-file.txt",
  ]);
  t.assert.deepStrictEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/virtual-file.txt",
  ]);
});

test("Glob search seeds ExistsCache directory listings", async (t) => {
  let cache = new ExistsCache();
  let fs = new FileSystemSearch(cache);
  await fs.search("templates", ["./test/_issues/4224/**/*.vZome"]);

  t.assert.strictEqual(cache.exists("./test/_issues/4224/sub/sub.JSON"), true);
  t.assert.strictEqual(cache.resolve("./test/_issues/4224/child.11tydata.json"), "./test/_issues/4224/child.11TYDATA.json");
  // Only the folders above the glob’s starting folder are read
  t.assert.strictEqual(cache.lookupCount, 3);
});

test("Glob search throws on file names that differ only by case #4224", async (t) => {
  let dir = mkdtempSync(path.join(os.tmpdir(), "ba-case-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, "index.md"), "");
  writeFileSync(path.join(dir, "INDEX.md"), "");
  if (readdirSync(dir).length < 2) {
    t.skip("Case-insensitive file system");
    return;
  }

  await t.assert.rejects(new FileSystemSearch().search("x", [`${dir}/*.md`]), /differ only by case/);
});

test("Glob search allows file names that differ only by case with allowCaseCollisions #4224", async (t) => {
  let dir = mkdtempSync(path.join(os.tmpdir(), "ba-case-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, "index.md"), "");
  writeFileSync(path.join(dir, "INDEX.md"), "");
  if (readdirSync(dir).length < 2) {
    t.skip("Case-insensitive file system");
    return;
  }

  let cache = new ExistsCache();
  cache.allowCaseCollisions = true;
  let results = await new FileSystemSearch(cache).search("x", [`${dir}/*.md`]);
  t.assert.strictEqual(results.length, 2);
});
