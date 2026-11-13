import test from "node:test";
import EleventyCompatibility from "../src/Util/Compatibility.js";

test(".canary- to .alpha- normalization (because pre-releases are alphabetic comparisons 😭)", (t) => {
  t.assert.strictEqual(EleventyCompatibility.normalizeIdentifier("2.0.0"), "2.0.0");
  t.assert.strictEqual(EleventyCompatibility.normalizeIdentifier("2.0.0-beta.1"), "2.0.0-beta.1");
  t.assert.strictEqual(EleventyCompatibility.normalizeIdentifier("2.0.0-canary.1"), "2.0.0-alpha.1");
  t.assert.strictEqual(EleventyCompatibility.normalizeIdentifier("2.0.0-alpha.1"), "2.0.0-alpha.1");
  t.assert.strictEqual(EleventyCompatibility.normalizeIdentifier(">=2.0.0-beta.1"), ">=2.0.0-beta.1");
  t.assert.strictEqual(
    EleventyCompatibility.normalizeIdentifier(">=2.0.0-beta.1 || >=2.0.0-canary.1"),
    ">=2.0.0-beta.1 || >=2.0.0-alpha.1"
  );
});

test("Version checking for plugin compatibility >=0.5.4", (t) => {
  let range = ">=0.5.4";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.3", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=0.6", (t) => {
  let range = ">=0.6";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.3", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=1", (t) => {
  let range = ">=1"; // **not** the same as >=1.0.0
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=1.0.0", (t) => {
  let range = ">=1.0.0"; // **not** the same as >=1
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=1.0.0 || >=1.0.0-beta || >=1.0.0-canary", (t) => {
  // could be simplified to >=1
  // noting that pre-1.0 versions of Eleventy did not match prereleases—which doesn’t matter because 0.12 would return false here anyway.
  let range = ">=1.0.0 || >=1.0.0-beta || >=1.0.0-canary";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=2", (t) => {
  let range = ">=2";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.3", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=2.0.0", (t) => {
  // Recommend to use >=2 instead of this
  let range = ">=2.0.0";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.3", range), false); // Contentious! I wish this were true
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), false); // Contentious! I wish this were true
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), false); // Contentious! I wish this were true
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), false); // Contentious! I wish this were true
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=2.0.0-canary", (t) => {
  // Recommend to use >=2 instead of this
  let range = ">=2.0.0-canary";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.3", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=2.0.0-canary.1", (t) => {
  // Recommend to use >=2 instead of this
  let range = ">=2.0.0-canary.1";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.3", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=2.0.0-beta", (t) => {
  let range = ">=2.0.0-beta";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=2.0.0-beta.1", (t) => {
  let range = ">=2.0.0-beta.1";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.2", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=2.0.0-beta.2", (t) => {
  let range = ">=2.0.0-beta.2";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.2", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

// TODO eleventy-upgrade-help
test("Version checking for plugin compatibility >=2 <3", (t) => {
  let range = ">=2 <3";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), false);
});

test("Version checking for plugin compatibility >=2.0.0-canary.19", (t) => {
  let range = ">=2.0.0-canary.19";
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=2.0.0-canary.19 || >=2.0.0-beta.1", (t) => {
  let range = ">=2.0.0-canary.19 || >=2.0.0-beta.1"; // can be simplified to >=2.0.0-canary.19
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});

test("Version checking for plugin compatibility >=2.0.0-canary.19 || >=2.0.0-beta.2", (t) => {
  let range = ">=2.0.0-canary.19 || >=2.0.0-beta.2"; // same as ">=2.0.0-canary.19"
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.0-beta.1", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("1.0.2", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.18", range), false);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-canary.19", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.1", range), true); // warning: this matches because of >=2.0.0-canary.19
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0-beta.2", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.0", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("2.0.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-canary.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0-beta.1", range), true);
  t.assert.strictEqual(EleventyCompatibility.satisfies("3.0.0", range), true);
});
