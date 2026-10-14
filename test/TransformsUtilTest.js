import test from "ava";
import TransformsUtil from "../src/Util/TransformsUtil.js";

test("TransformsUtil.runall", async (t) => {
  t.is(await TransformsUtil.runAll("Test content", {}, {
    test: function(content) {
      return content + "Overridden!"
    }
  }), "Test contentOverridden!");
});

test("TransformsUtil.runall empty warning", async (t) => {
  t.plan(2);
  t.is(await TransformsUtil.runAll("Test content", {
    inputPath: "fake input path",
    outputPath: "fake output path",
  }, {
    test: function() {
      return "";
    }
  },
  {
    logger: {
      warn: (message) => {
        t.is(message, 'Warning: Transform `test` returned empty when writing fake output path from fake input path.');
      }
    }
  }), "");
});
