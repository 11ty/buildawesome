import test from "node:test";
import WatchQueue from "../src/WatchQueue.js";

test("Standard", (t) => {
  let watch = new WatchQueue();
  t.assert.strictEqual(watch.isBuildRunning(), false);

  watch.startBuild();
  t.assert.strictEqual(watch.isBuildRunning(), false); // nothing in the queue

  watch.finishBuild(); // still nothing in the queue
  t.assert.strictEqual(watch.isBuildRunning(), false);
});

test("Queue 1", (t) => {
  let watch = new WatchQueue();
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);

  watch.addToPendingQueue("test.md");
  t.assert.strictEqual(watch.getPendingQueueSize(), 1);
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);

  watch.startBuild();
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.strictEqual(watch.getActiveQueueSize(), 1);
  t.assert.deepStrictEqual(watch.getActiveQueue(), ["./test.md"]);

  watch.finishBuild();
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);
});

test("Queue 2", (t) => {
  let watch = new WatchQueue();
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);

  watch.addToPendingQueue("test.md");
  watch.addToPendingQueue("test2.md");
  t.assert.strictEqual(watch.getPendingQueueSize(), 2);
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);

  t.assert.strictEqual(watch.isBuildRunning(), false);

  watch.startBuild();
  t.assert.strictEqual(watch.isBuildRunning(), true);
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.strictEqual(watch.getActiveQueueSize(), 2);
  t.assert.deepStrictEqual(watch.getActiveQueue(), ["./test.md", "./test2.md"]);

  t.assert.strictEqual(watch.isBuildRunning(), true);
  watch.finishBuild();
  t.assert.strictEqual(watch.isBuildRunning(), false);
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getPendingQueue(), []);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);
});

test("Add while active", (t) => {
  let watch = new WatchQueue();
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);

  watch.addToPendingQueue("test.md");
  t.assert.strictEqual(watch.getPendingQueueSize(), 1);
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);

  t.assert.strictEqual(watch.isBuildRunning(), false);

  watch.startBuild();
  t.assert.strictEqual(watch.isBuildRunning(), true);
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.strictEqual(watch.getActiveQueueSize(), 1);
  t.assert.deepStrictEqual(watch.getActiveQueue(), ["./test.md"]);

  watch.addToPendingQueue("test.md");
  t.assert.strictEqual(watch.getPendingQueueSize(), 1);
  t.assert.strictEqual(watch.getActiveQueueSize(), 1);
  t.assert.deepStrictEqual(watch.getActiveQueue(), ["./test.md"]);
  t.assert.strictEqual(watch.isBuildRunning(), true);

  watch.finishBuild();
  t.assert.strictEqual(watch.isBuildRunning(), false);
  t.assert.strictEqual(watch.getPendingQueueSize(), 1);
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getPendingQueue(), ["./test.md"]);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);
});

test("Active queue tests", (t) => {
  let watch = new WatchQueue();
  watch.addToPendingQueue("test.md");
  watch.addToPendingQueue("test2.md");
  watch.addToPendingQueue("test.css");

  t.assert.strictEqual(
    watch.hasAllQueueFiles((path) => path.startsWith("./test")),
    false
  );

  t.assert.strictEqual(watch.isBuildRunning(), false);

  watch.startBuild();
  t.assert.strictEqual(watch.hasAllQueueFiles("slkdjflkjsdlkfj"), false);
  t.assert.strictEqual(
    watch.hasAllQueueFiles((path) => path.startsWith("./test")),
    true
  );
  t.assert.strictEqual(
    watch.hasAllQueueFiles((path) => path.endsWith(".css")),
    false
  );

  t.assert.strictEqual(watch.hasQueuedFile("./test.md"), true);
  t.assert.strictEqual(watch.hasQueuedFile("./testsdkljfklja.md"), false);
  t.assert.strictEqual(watch.isBuildRunning(), true);
  watch.finishBuild();
  t.assert.strictEqual(watch.isBuildRunning(), false);

  t.assert.strictEqual(
    watch.hasAllQueueFiles((path) => path.startsWith("./test")),
    false
  );
});

test("Active queue tests, all CSS files", (t) => {
  let watch = new WatchQueue();
  watch.addToPendingQueue("test.css");
  watch.addToPendingQueue("test2.css");
  watch.addToPendingQueue("test3.css");

  t.assert.strictEqual(
    watch.hasAllQueueFiles((path) => path.endsWith(".css")),
    false
  );

  t.assert.strictEqual(watch.isBuildRunning(), false);

  watch.startBuild();
  t.assert.strictEqual(watch.isBuildRunning(), true);
  t.assert.strictEqual(
    watch.hasAllQueueFiles((path) => path.endsWith(".css")),
    true
  );
  t.assert.strictEqual(watch.isBuildRunning(), true);
  watch.finishBuild();
  t.assert.strictEqual(watch.isBuildRunning(), false);

  t.assert.strictEqual(
    watch.hasAllQueueFiles((path) => path.endsWith(".css")),
    false
  );
});

test("De-duplicate the entries in pending queue", (t) => {
  let watch = new WatchQueue();

  t.assert.strictEqual(watch.getPendingQueueSize(), 0);

  watch.addToPendingQueue("test.md");
  watch.addToPendingQueue("test.md");
  watch.addToPendingQueue("test.md");

  t.assert.strictEqual(watch.getPendingQueueSize(), 1);
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);

  watch.startBuild();
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.strictEqual(watch.getActiveQueueSize(), 1);
  t.assert.deepStrictEqual(watch.getActiveQueue(), ["./test.md"]);

  watch.finishBuild();
  t.assert.strictEqual(watch.getPendingQueueSize(), 0);
  t.assert.strictEqual(watch.getActiveQueueSize(), 0);
  t.assert.deepStrictEqual(watch.getActiveQueue(), []);
});
