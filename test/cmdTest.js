import test from "ava";
import { exec } from "child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function parseEvents(stdout) {
  return stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

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
        t.is(stdout.indexOf("THIS SHOULD NOT LOG TO CONSOLE"), -1);
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
        t.is(stdout.indexOf("THIS SHOULD NOT LOG TO CONSOLE"), -1);
        resolve();
      }
    );
  });
});

test("Test command line --reporter=ndjson success", async (t) => {
  // --dryrun leaves pages empty
  let output = mkdtempSync(path.join(tmpdir(), "buildawesome-ndjson-"));
  t.teardown(() => rmSync(output, { recursive: true, force: true }));

  await new Promise((resolve) => {
    exec(
      `node ./cmd.cjs --input=test/stubs/ndjson-ok --output=${output} --formats=md --reporter=ndjson`,
      (error, stdout, stderr) => {
        t.falsy(error);
        let events = parseEvents(stdout);
        let start = events.find((e) => e.type === "build.start");
        let end = events.find((e) => e.type === "build.end");
        t.is(start.v, 1);
        t.is(end.ok, true);
        t.is(end.pages.length, 1);
        t.is(end.pages[0].url, "/");
        t.is(typeof end.pages[0].inputPath, "string");
        t.false("content" in end.pages[0]);
        t.true(stderr.length > 0);
        resolve();
      }
    );
  });
});

test("Test command line --reporter=ndjson template error", async (t) => {
  await new Promise((resolve) => {
    exec(
      "node ./cmd.cjs --input=test/stubs/ndjson-broken --formats=njk --reporter=ndjson --dryrun",
      (error, stdout, stderr) => {
        t.is(error.code, 1);
        let events = parseEvents(stdout);
        let buildError = events.find((e) => e.type === "build.error");
        t.is(buildError.ok, false);
        t.is(typeof buildError.error.message, "string");
        resolve();
      }
    );
  });
});

test("Test command line --reporter=ndjson rejects --to=json", async (t) => {
  await new Promise((resolve) => {
    exec(
      "node ./cmd.cjs --input=test/stubs/ndjson-ok --formats=md --reporter=ndjson --to=json",
      (error, stdout, stderr) => {
        t.is(error.code, 1);
        t.is(stdout, "");
        t.true(stderr.includes("not compatible with --to=json"));
        resolve();
      }
    );
  });
});
