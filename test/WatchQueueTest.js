import test from "ava";
import WatchQueue from "../src/WatchQueue.js";

test("Standard", (t) => {
  let watch = new WatchQueue();
  t.is(watch.isBuildRunning(), false);

  watch.startBuild();
  t.is(watch.isBuildRunning(), false); // nothing in the queue

  watch.finishBuild(); // still nothing in the queue
  t.is(watch.isBuildRunning(), false);
});

test("Queue 1", (t) => {
  let watch = new WatchQueue();
  t.is(watch.getActiveQueueSize(), 0);
  t.is(watch.getPendingQueueSize(), 0);
  t.deepEqual(watch.getActiveQueue(), []);

  watch.addToPendingQueue("test.md");
  t.is(watch.getPendingQueueSize(), 1);
  t.is(watch.getActiveQueueSize(), 0);
  t.deepEqual(watch.getActiveQueue(), []);

  watch.startBuild();
  t.is(watch.getPendingQueueSize(), 0);
  t.is(watch.getActiveQueueSize(), 1);
  t.deepEqual(watch.getActiveQueue(), ["./test.md"]);

  watch.finishBuild();
  t.is(watch.getPendingQueueSize(), 0);
  t.is(watch.getActiveQueueSize(), 0);
  t.deepEqual(watch.getActiveQueue(), []);
});

test("Queue 2", (t) => {
  let watch = new WatchQueue();
  t.is(watch.getActiveQueueSize(), 0);
  t.is(watch.getPendingQueueSize(), 0);
  t.deepEqual(watch.getActiveQueue(), []);

  watch.addToPendingQueue("test.md");
  watch.addToPendingQueue("test2.md");
  t.is(watch.getPendingQueueSize(), 2);
  t.is(watch.getActiveQueueSize(), 0);
  t.deepEqual(watch.getActiveQueue(), []);

  t.is(watch.isBuildRunning(), false);

  watch.startBuild();
  t.is(watch.isBuildRunning(), true);
  t.is(watch.getPendingQueueSize(), 0);
  t.is(watch.getActiveQueueSize(), 2);
  t.deepEqual(watch.getActiveQueue(), ["./test.md", "./test2.md"]);

  t.is(watch.isBuildRunning(), true);
  watch.finishBuild();
  t.is(watch.isBuildRunning(), false);
  t.is(watch.getPendingQueueSize(), 0);
  t.is(watch.getActiveQueueSize(), 0);
  t.deepEqual(watch.getPendingQueue(), []);
  t.deepEqual(watch.getActiveQueue(), []);
});

test("Add while active", (t) => {
  let watch = new WatchQueue();
  t.is(watch.getActiveQueueSize(), 0);
  t.is(watch.getPendingQueueSize(), 0);
  t.is(watch.getActiveQueueSize(), 0);

  watch.addToPendingQueue("test.md");
  t.is(watch.getPendingQueueSize(), 1);
  t.is(watch.getActiveQueueSize(), 0);
  t.deepEqual(watch.getActiveQueue(), []);

  t.is(watch.isBuildRunning(), false);

  watch.startBuild();
  t.is(watch.isBuildRunning(), true);
  t.is(watch.getPendingQueueSize(), 0);
  t.is(watch.getActiveQueueSize(), 1);
  t.deepEqual(watch.getActiveQueue(), ["./test.md"]);

  watch.addToPendingQueue("test.md");
  t.is(watch.getPendingQueueSize(), 1);
  t.is(watch.getActiveQueueSize(), 1);
  t.deepEqual(watch.getActiveQueue(), ["./test.md"]);
  t.is(watch.isBuildRunning(), true);

  watch.finishBuild();
  t.is(watch.isBuildRunning(), false);
  t.is(watch.getPendingQueueSize(), 1);
  t.is(watch.getActiveQueueSize(), 0);
  t.deepEqual(watch.getPendingQueue(), ["./test.md"]);
  t.deepEqual(watch.getActiveQueue(), []);
});

test("Active queue tests", (t) => {
  let watch = new WatchQueue();
  watch.addToPendingQueue("test.md");
  watch.addToPendingQueue("test2.md");
  watch.addToPendingQueue("test.css");

  t.is(
    watch.hasAllQueueFiles((path) => path.startsWith("./test")),
    false
  );

  t.is(watch.isBuildRunning(), false);

  watch.startBuild();
  t.is(watch.hasAllQueueFiles("slkdjflkjsdlkfj"), false);
  t.is(
    watch.hasAllQueueFiles((path) => path.startsWith("./test")),
    true
  );
  t.is(
    watch.hasAllQueueFiles((path) => path.endsWith(".css")),
    false
  );

  t.is(watch.hasQueuedFile("./test.md"), true);
  t.is(watch.hasQueuedFile("./testsdkljfklja.md"), false);
  t.is(watch.isBuildRunning(), true);
  watch.finishBuild();
  t.is(watch.isBuildRunning(), false);

  t.is(
    watch.hasAllQueueFiles((path) => path.startsWith("./test")),
    false
  );
});

test("Active queue tests, all CSS files", (t) => {
  let watch = new WatchQueue();
  watch.addToPendingQueue("test.css");
  watch.addToPendingQueue("test2.css");
  watch.addToPendingQueue("test3.css");

  t.is(
    watch.hasAllQueueFiles((path) => path.endsWith(".css")),
    false
  );

  t.is(watch.isBuildRunning(), false);

  watch.startBuild();
  t.is(watch.isBuildRunning(), true);
  t.is(
    watch.hasAllQueueFiles((path) => path.endsWith(".css")),
    true
  );
  t.is(watch.isBuildRunning(), true);
  watch.finishBuild();
  t.is(watch.isBuildRunning(), false);

  t.is(
    watch.hasAllQueueFiles((path) => path.endsWith(".css")),
    false
  );
});

test("De-duplicate the entries in pending queue", (t) => {
  let watch = new WatchQueue();

  t.is(watch.getPendingQueueSize(), 0);

  watch.addToPendingQueue("test.md");
  watch.addToPendingQueue("test.md");
  watch.addToPendingQueue("test.md");

  t.is(watch.getPendingQueueSize(), 1);
  t.is(watch.getActiveQueueSize(), 0);
  t.deepEqual(watch.getActiveQueue(), []);

  watch.startBuild();
  t.is(watch.getPendingQueueSize(), 0);
  t.is(watch.getActiveQueueSize(), 1);
  t.deepEqual(watch.getActiveQueue(), ["./test.md"]);

  watch.finishBuild();
  t.is(watch.getPendingQueueSize(), 0);
  t.is(watch.getActiveQueueSize(), 0);
  t.deepEqual(watch.getActiveQueue(), []);
});
