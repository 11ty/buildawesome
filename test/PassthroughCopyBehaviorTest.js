import test from "node:test";
import checkPassthroughCopyBehavior from "../src/Util/PassthroughCopyBehaviorCheck.js";

test("Standard use", (t) => {
  t.assert.strictEqual(
    checkPassthroughCopyBehavior(
      {
        serverPassthroughCopyBehavior: "passthrough",
        serverOptions: {},
      },
      "serve"
    ),
    true
  );
});

test("Config fallback", (t) => {
  t.assert.strictEqual(
    checkPassthroughCopyBehavior(
      {
        serverPassthroughCopyBehavior: "copy",
        serverOptions: {},
      },
      "serve"
    ),
    false
  );
});

test("Other dev server", (t) => {
  t.assert.strictEqual(
    checkPassthroughCopyBehavior(
      {
        serverPassthroughCopyBehavior: "passthrough",
        serverOptions: {
          module: "somethingelse",
        },
      },
      "serve"
    ),
    false
  );
});

test("Non --serve run modes", (t) => {
  t.assert.strictEqual(
    checkPassthroughCopyBehavior(
      {
        serverPassthroughCopyBehavior: "passthrough",
        serverOptions: {},
      },
      "watch"
    ),
    false
  );

  t.assert.strictEqual(
    checkPassthroughCopyBehavior(
      {
        serverPassthroughCopyBehavior: "passthrough",
        serverOptions: {},
      },
      "build"
    ),
    false
  );
});
