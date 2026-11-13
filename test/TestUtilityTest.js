import test from "node:test";
import { normalizeNewLines } from "./Util/normalizeNewLines.js";

test("normalizeNewLines", (t) => {
  t.assert.strictEqual(normalizeNewLines("\n"), "\n");
  t.assert.strictEqual(normalizeNewLines("\r\n"), "\n");
  t.assert.strictEqual(normalizeNewLines("\r\n\n"), "\n\n");
  t.assert.strictEqual(normalizeNewLines("\r\n\r\n"), "\n\n");
  t.assert.strictEqual(normalizeNewLines("a\r\nhello\r\nhi"), "a\nhello\nhi");
});
