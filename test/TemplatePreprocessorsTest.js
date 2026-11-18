import test from "node:test";
import { TemplatePreprocessors } from "../src/TemplatePreprocessors.js";

const template = {
  inputPath: "./test/index.njk",
  getPreRender: async () => "Before",
};

test("Invalid preprocessor filter type throws", async (t) => {
  await t.assert.rejects(
    TemplatePreprocessors.runAll({ bad: { filter: 1, callback: () => {} } }, template, {}),
    { message: /Expected file extensions passed to "bad" content preprocessor/ },
  );
});

test("Preprocessor callback errors are wrapped", async (t) => {
  let cause = new Error("Oops");
  await t.assert.rejects(
    TemplatePreprocessors.runAll(
      { broken: { filter: "njk", callback: () => { throw cause; } } },
      template,
      {},
    ),
    (e) => e.message.startsWith("Preprocessor `broken` encountered an error") && e.cause === cause,
  );
});
