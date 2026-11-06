import test from "node:test";
import { coerce } from "../src/Util/SemverCoerce.js";

test("semverCoerce", t => {
  t.assert.strictEqual(coerce("4.0.0"), "4.0.0");
  t.assert.strictEqual(coerce("4.0.0-prerelease"), "4.0.0");
  t.assert.strictEqual(coerce("4.0"), "4.0");
  t.assert.strictEqual(coerce("v4.0"), "4.0");
});
