import test from "node:test";
import { resolveAttributeName } from "../src/Util/PostHtml/Attrs.js";

test("Looking for unprefixed key", t => {
  t.assert.strictEqual(resolveAttributeName({"key": "value"}, "key"), undefined);
  t.assert.strictEqual(resolveAttributeName({"eleventy:key": "value"}, "key"), undefined);
  t.assert.strictEqual(resolveAttributeName({"buildawesome:key": "value"}, "key"), undefined);
  t.assert.strictEqual(resolveAttributeName({"eleventy:key": "value1", "buildawesome:key": "value2"}, "key"), undefined);
});

test("Looking for notfound:key", t => {
  t.assert.strictEqual(resolveAttributeName({"buildawesome:key": "value"}, "notfound:key"), undefined);
  t.assert.strictEqual(resolveAttributeName({"eleventy:key": "value"}, "notfound:key"), undefined);
  t.assert.strictEqual(resolveAttributeName({"eleventy:key": "value1", "buildawesome:key": "value2"}, "notfound:key"), undefined);
});

// Should always cross-map to the attribute name that exists
test("Looking for buildawesome:key", t => {
  t.assert.strictEqual(resolveAttributeName({"buildawesome:key": "value"}, "buildawesome:key"), "buildawesome:key");
  t.assert.strictEqual(resolveAttributeName({"eleventy:key": "value"}, "buildawesome:key"), "eleventy:key");

  // if conflict, buildawesome: is preferred
  t.assert.strictEqual(resolveAttributeName({"eleventy:key": "value1", "buildawesome:key": "value2"}, "buildawesome:key"), "buildawesome:key");
});

// Should always cross-map to the attribute name that exists
test("Looking for eleventy:key", t => {
  t.assert.strictEqual(resolveAttributeName({"buildawesome:key": "value"}, "eleventy:key"), "buildawesome:key");
  t.assert.strictEqual(resolveAttributeName({"eleventy:key": "value"}, "eleventy:key"), "eleventy:key");

  // if conflict, buildawesome: is preferred
  t.assert.strictEqual(resolveAttributeName({"eleventy:key": "value1", "buildawesome:key": "value2"}, "eleventy:key"), "buildawesome:key");

});

