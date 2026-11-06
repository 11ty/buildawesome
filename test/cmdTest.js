import test, { describe } from "node:test";
import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";
import { deleteDirectory } from "./_testHelpers.js";

function readEvents(filePath) {
  return readFileSync(filePath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test.after(() => {
  deleteDirectory("./test/stubs/events-file-ok/_site/");
  deleteDirectory("./test/stubs/events-file-passthrough/_site/");
  deleteDirectory("./test/stubs/events-file-broken/_site/");
  deleteDirectory("./test/stubs/events-file-broken-data/_site/");
});

describe("Command line", { concurrency: true }, () => {
  test("Test command line exit code success", async (t) => {
    await new Promise((resolve) => {
      exec("node ./cmd.cjs --input=test/stubs/exitCode_success --dryrun", (error, stdout, stderr) => {
        t.assert.ok(!error);
        resolve();
      });
    });
  });

  test("Test command line exit code for template error", async (t) => {
    await new Promise((resolve) => {
      exec("node ./cmd.cjs --input=test/stubs/exitCode --dryrun", (error, stdout, stderr) => {
        t.assert.strictEqual(error.code, 1);
        resolve();
      });
    });
  });

  test("Test command line exit code for global data error", async (t) => {
    await new Promise((resolve) => {
      exec(
        "node ./cmd.cjs --input=test/stubs/exitCode_globalData --dryrun",
        (error, stdout, stderr) => {
          t.assert.strictEqual(error.code, 1);
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
          t.assert.ok(!error);
          t.assert.strictEqual(stdout.includes("THIS SHOULD NOT LOG TO CONSOLE"), false);
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
          t.assert.ok(!error);
          t.assert.strictEqual(stdout.includes("THIS SHOULD NOT LOG TO CONSOLE"), false);
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
          t.assert.ok(!error);
          let events = readEvents(eventsFile);
          let start = events.find((e) => e.type === "build.start");
          let end = events.find((e) => e.type === "build.end");
          t.assert.strictEqual(start.v, 1);
          t.assert.strictEqual(end.ok, true);
          t.assert.strictEqual(Number.isInteger(end.durationMs), true);
          t.assert.strictEqual(end.pages.length, 1);
          t.assert.strictEqual(end.pages[0].url, "/");
          t.assert.strictEqual(typeof end.pages[0].inputPath, "string");
          t.assert.strictEqual("content" in end.pages[0], false);
          t.assert.strictEqual(stripVTControlCharacters(stdout).includes("Wrote 1 file"), true);
          t.assert.strictEqual(stdout.includes('{"v":1'), false);
          resolve();
        }
      );
    });
  });

  // Warning: this test writes to the file system
  test("Test command line --events-file writes a passthrough event", async (t) => {
    let eventsFile = "test/stubs/events-file-passthrough/_site/.events.ndjson";

    await new Promise((resolve) => {
      exec(
        `node ./cmd.cjs --input=test/stubs/events-file-passthrough --output=test/stubs/events-file-passthrough/_site --formats=md --config=test/stubs/events-file-passthrough.config.js --events-file=${eventsFile}`,
        (error, stdout, stderr) => {
          t.assert.ok(!error);
          let events = readEvents(eventsFile);
          t.assert.deepStrictEqual(events.map((e) => e.type), ["build.start", "passthrough", "build.end"]);
          let passthrough = events[1];
          t.assert.strictEqual(passthrough.v, 1);
          t.assert.strictEqual(passthrough.emulated, false);
          t.assert.deepStrictEqual(passthrough.map, {
            "/robots.txt": "test/stubs/events-file-passthrough/robots.txt",
            "/img/a.txt": "test/stubs/events-file-passthrough/img/a.txt",
          });
          t.assert.deepStrictEqual(passthrough.copied, ["/robots.txt", "/img/a.txt"]);
          resolve();
        }
      );
    });
  });

  test("Test command line --events-file writes an empty passthrough map without passthrough copy", async (t) => {
    let eventsFile = "test/stubs/events-file-ok/_site/no-passthrough/.events.ndjson";

    await new Promise((resolve) => {
      exec(
        `node ./cmd.cjs --input=test/stubs/events-file-ok --formats=md --events-file=${eventsFile} --dryrun`,
        (error, stdout, stderr) => {
          t.assert.ok(!error);
          let passthrough = readEvents(eventsFile).filter((e) => e.type === "passthrough");
          t.assert.strictEqual(passthrough.length, 1);
          t.assert.deepStrictEqual(passthrough[0].map, {});
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
          t.assert.ok(!error);
          t.assert.strictEqual(JSON.parse(stdout)[0].url, "/");
          let events = readEvents(eventsFile);
          let end = events.find((e) => e.type === "build.end");
          t.assert.strictEqual(end.pages.length, 1);
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
          t.assert.strictEqual(error.code, 1);
          t.assert.strictEqual(stderr.includes("--events-file requires a single file path"), true);
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
          t.assert.strictEqual(error.code, 1);
          t.assert.strictEqual(stderr.includes("--events-file requires a single file path"), true);
          resolve();
        }
      );
    });
  });

  // Warning: this test writes to the file system
  test("Test command line --events-file writes build.error instead of build.end when an after listener throws", async (t) => {
    let eventsFile = "test/stubs/events-file-ok/_site/after-throws/.events.ndjson";

    await new Promise((resolve) => {
      exec(
        `node ./cmd.cjs --input=test/stubs/events-file-ok --formats=md --config=test/stubs/events-file-after-throws.config.js --events-file=${eventsFile} --dryrun`,
        (error, stdout, stderr) => {
          t.assert.strictEqual(error.code, 1);
          let events = readEvents(eventsFile);
          let types = events.map((e) => e.type);
          t.assert.deepStrictEqual(types, ["build.start", "passthrough", "build.error"]);
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
          t.assert.strictEqual(error.code, 1);
          let events = readEvents(eventsFile);
          let buildError = events.find((e) => e.type === "build.error");
          t.assert.strictEqual(buildError.ok, false);
          t.assert.strictEqual(typeof buildError.error.message, "string");
          t.assert.strictEqual(buildError.error.filePath, "./test/stubs/events-file-broken/index.njk");
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
          t.assert.strictEqual(error.code, 1);
          let events = readEvents(eventsFile);
          let buildError = events.find((e) => e.type === "build.error");
          t.assert.strictEqual(buildError.error.filePath, "./test/stubs/events-file-broken-data/_data/bad.json");
          resolve();
        }
      );
    });
  });
});
