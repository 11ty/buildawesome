import test from "ava";
import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { deleteDirectory } from "./_testHelpers.js";

function readEvents(filePath) {
  return readFileSync(filePath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test.after.always("Directory cleanup", () => {
  deleteDirectory("./test/stubs/events-file-ok/_site/");
  deleteDirectory("./test/stubs/events-file-broken/_site/");
  deleteDirectory("./test/stubs/events-file-broken-data/_site/");
});

test("Test command line exit code success", async (t) => {
  await new Promise((resolve) => {
    exec("node ./cmd.cjs --input=test/stubs/exitCode_success --dryrun", (error, stdout, stderr) => {
      t.falsy(error);
      resolve();
    });
  });
});

test("Test command line exit code for template error", async (t) => {
  await new Promise((resolve) => {
    exec("node ./cmd.cjs --input=test/stubs/exitCode --dryrun", (error, stdout, stderr) => {
      t.is(error.code, 1);
      resolve();
    });
  });
});

test("Test command line exit code for global data error", async (t) => {
  await new Promise((resolve) => {
    exec(
      "node ./cmd.cjs --input=test/stubs/exitCode_globalData --dryrun",
      (error, stdout, stderr) => {
        t.is(error.code, 1);
        resolve();
      }
    );
  });
});

test("Test data should not process in a --help", async (t) => {
  await new Promise((resolve) => {
    exec(
      "node ./cmd.cjs --input=test/stubs/cmd-help-processing --help",
      (error, stdout, stderr) => {
        t.falsy(error);
        t.false(stdout.includes("THIS SHOULD NOT LOG TO CONSOLE"));
        resolve();
      }
    );
  });
});

test("Test data should not process in a --version", async (t) => {
  await new Promise((resolve) => {
    exec(
      "node ./cmd.cjs --input=test/stubs/cmd-help-processing --version",
      (error, stdout, stderr) => {
        t.falsy(error);
        t.false(stdout.includes("THIS SHOULD NOT LOG TO CONSOLE"));
        resolve();
      }
    );
  });
});

// Warning: this test writes to the file system
test("Test command line --events-file writes build.end on success", async (t) => {
  // --dryrun leaves pages empty
  // Parent dir doesn’t exist yet
  let eventsFile = "test/stubs/events-file-ok/_site/success/logs/.events.ndjson";

  await new Promise((resolve) => {
    exec(
      `node ./cmd.cjs --input=test/stubs/events-file-ok --output=test/stubs/events-file-ok/_site/success --formats=md --events-file=${eventsFile}`,
      (error, stdout, stderr) => {
        t.falsy(error);
        let events = readEvents(eventsFile);
        let start = events.find((e) => e.type === "build.start");
        let end = events.find((e) => e.type === "build.end");
        t.is(start.v, 1);
        t.true(end.ok);
        t.true(Number.isInteger(end.durationMs));
        t.is(end.pages.length, 1);
        t.is(end.pages[0].url, "/");
        t.is(typeof end.pages[0].inputPath, "string");
        t.false("content" in end.pages[0]);
        t.true(stdout.includes("Wrote 1 file"));
        t.false(stdout.includes('{"v":1'));
        resolve();
      }
    );
  });
});

// Warning: this test writes to the file system
test("Test command line --events-file works with --to=json", async (t) => {
  let eventsFile = "test/stubs/events-file-ok/_site/json/.events.ndjson";

  await new Promise((resolve) => {
    exec(
      `node ./cmd.cjs --input=test/stubs/events-file-ok --formats=md --to=json --events-file=${eventsFile}`,
      (error, stdout, stderr) => {
        t.falsy(error);
        t.is(JSON.parse(stdout)[0].url, "/");
        let events = readEvents(eventsFile);
        let end = events.find((e) => e.type === "build.end");
        t.is(end.pages.length, 1);
        resolve();
      }
    );
  });
});

test("Test command line --events-file requires a path", async (t) => {
  await new Promise((resolve) => {
    exec(
      "node ./cmd.cjs --input=test/stubs/events-file-ok --formats=md --events-file --dryrun",
      (error, stdout, stderr) => {
        t.is(error.code, 1);
        t.true(stderr.includes("--events-file requires a single file path"));
        resolve();
      }
    );
  });
});

test("Test command line --events-file rejects repeated flags", async (t) => {
  await new Promise((resolve) => {
    exec(
      "node ./cmd.cjs --input=test/stubs/events-file-ok --formats=md --events-file=test/stubs/events-file-ok/_site/repeated/a/.events.ndjson --events-file=test/stubs/events-file-ok/_site/repeated/b/.events.ndjson --dryrun",
      (error, stdout, stderr) => {
        t.is(error.code, 1);
        t.true(stderr.includes("--events-file requires a single file path"));
        resolve();
      }
    );
  });
});

// Warning: this test writes to the file system
test("Test command line --events-file writes only build.error when an after listener throws", async (t) => {
  let eventsFile = "test/stubs/events-file-ok/_site/after-throws/.events.ndjson";

  await new Promise((resolve) => {
    exec(
      `node ./cmd.cjs --input=test/stubs/events-file-ok --formats=md --config=test/stubs/events-file-after-throws.config.js --events-file=${eventsFile} --dryrun`,
      (error, stdout, stderr) => {
        t.is(error.code, 1);
        let events = readEvents(eventsFile);
        let types = events.map((e) => e.type);
        t.deepEqual(types, ["build.start", "build.error"]);
        resolve();
      }
    );
  });
});

// Warning: this test writes to the file system
test("Test command line --events-file writes build.error for a template error", async (t) => {
  let eventsFile = "test/stubs/events-file-broken/_site/template-error/.events.ndjson";

  await new Promise((resolve) => {
    exec(
      `node ./cmd.cjs --input=test/stubs/events-file-broken --formats=njk --events-file=${eventsFile} --dryrun`,
      (error, stdout, stderr) => {
        t.is(error.code, 1);
        let events = readEvents(eventsFile);
        let buildError = events.find((e) => e.type === "build.error");
        t.false(buildError.ok);
        t.is(typeof buildError.error.message, "string");
        t.is(buildError.error.filePath, "./test/stubs/events-file-broken/index.njk");
        resolve();
      }
    );
  });
});

// Warning: this test writes to the file system
test("Test command line --events-file writes build.error for a data file error", async (t) => {
  let eventsFile = "test/stubs/events-file-broken-data/_site/data-file-error/.events.ndjson";

  await new Promise((resolve) => {
    exec(
      `node ./cmd.cjs --input=test/stubs/events-file-broken-data --formats=md --events-file=${eventsFile} --dryrun`,
      (error, stdout, stderr) => {
        t.is(error.code, 1);
        let events = readEvents(eventsFile);
        let buildError = events.find((e) => e.type === "build.error");
        t.is(buildError.error.filePath, "./test/stubs/events-file-broken-data/_data/bad.json");
        resolve();
      }
    );
  });
});
