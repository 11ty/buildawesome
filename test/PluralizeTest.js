import test from "node:test";

import pluralize from "../src/Util/Pluralize.js";

test("Pluralize", (t) => {
  t.assert.strictEqual(pluralize(0, "test", "tests"), "tests");
  t.assert.strictEqual(pluralize(1, "test", "tests"), "test");
  t.assert.strictEqual(pluralize(2, "test", "tests"), "tests");
  t.assert.strictEqual(pluralize(3, "test", "tests"), "tests");
  t.assert.strictEqual(pluralize(3.5, "test", "tests"), "tests");
});
