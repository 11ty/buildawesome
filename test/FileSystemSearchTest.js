import test from "ava";
import path from "node:path";
import FileSystemSearch from "../src/FileSystemSearch.js";

test("Base", async (t) => {
  let fs = new FileSystemSearch();
  t.is(fs.count, 0);

  t.deepEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/file.txt",
  ]);
  t.is(fs.count, 1);

  fs.add("./test/file-system-search/virtual-file.txt");
  t.deepEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/file.txt",
    "./test/file-system-search/virtual-file.txt",
  ]);
  t.is(fs.count, 1);

  fs.add("./test/file-system-search/another-file.txt");
  t.deepEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/file.txt",
    "./test/file-system-search/virtual-file.txt",
    "./test/file-system-search/another-file.txt",
  ]);
  t.is(fs.count, 1);

  // Delete
  fs.delete("./test/file-system-search/file.txt");
  t.deepEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/virtual-file.txt",
    "./test/file-system-search/another-file.txt",
  ]);
  t.is(fs.count, 1);

  fs.delete("./test/file-system-search/another-file.txt");
  t.deepEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/virtual-file.txt",
  ]);
  t.is(fs.count, 1);

  fs.delete("./test/file-system-search/virtual-file.txt");
  t.deepEqual(await fs.search("key", "./test/file-system-search/*.txt"), []);
  t.is(fs.count, 1);
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

  t.true(
    results.includes("./test/file-system-search/windows-new-file.txt")
  );
});

test("Added paths use platform separators (backslashes on Windows)", async (t) => {
  let fs = new FileSystemSearch();
  await fs.search("key", "./test/file-system-search/*.txt");

  fs.add(path.join("test", "file-system-search", "native-file.txt"));
  t.deepEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/file.txt",
    "./test/file-system-search/native-file.txt",
  ]);

  fs.delete(path.join(".", "test", "file-system-search", "file.txt"));
  t.deepEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/native-file.txt",
  ]);
});

test("Modifications during an in-flight search are applied", async (t) => {
  let fs = new FileSystemSearch();
  let pending = fs.search("key", "./test/file-system-search/*.txt");

  fs.add("./test/file-system-search/virtual-file.txt");
  fs.delete("./test/file-system-search/file.txt");

  t.deepEqual(await pending, [
    "./test/file-system-search/virtual-file.txt",
  ]);
  t.deepEqual(await fs.search("key", "./test/file-system-search/*.txt"), [
    "./test/file-system-search/virtual-file.txt",
  ]);
});
