import test from "node:test";
import fs from "node:fs";

import FileSystemSearch from "../src/FileSystemSearch.js";
import TemplatePassthrough from "../src/TemplatePassthrough.js";
import {
  getTemplateConfigInstance,
  getTemplateConfigInstanceCustomCallback,
} from "./_testHelpers.js";

const DIR = "test/_generated/passthrough-case";
const ON_DISK = `./${DIR}/dist/`; // lowercase on disk
const WRONG_CASE = `./${DIR}/Dist/`; // queried with the wrong case

function createFixture() {
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(`${DIR}/dist/js`, { recursive: true });
  fs.writeFileSync(`${DIR}/dist/js/a.js`, "x");
}

test.after(() => {
  fs.rmSync(DIR, { recursive: true, force: true });
});

function passthrough(templateConfig, inputPath) {
  let p = new TemplatePassthrough(
    { inputPath, outputPath: "/", copyOptions: {} },
    templateConfig,
  );
  p.setFileSystemSearch(new FileSystemSearch());
  return p;
}

test("Case-only miss throws by default", async (t) => {
  createFixture();
  let cfg = await getTemplateConfigInstance({ dir: { input: DIR, output: `${DIR}/_site` } });
  let pass = passthrough(cfg, WRONG_CASE);
  await t.assert.rejects(() => pass.getFileMap(), /differs only by case/);
});

test("Exact case still copies the directory (no false positive)", async (t) => {
  createFixture();
  let cfg = await getTemplateConfigInstance({ dir: { input: DIR, output: `${DIR}/_site` } });
  let pass = passthrough(cfg, ON_DISK);
  let map = await pass.getFileMap();
  t.assert.strictEqual(map.length, 1);
  t.assert.strictEqual(map[0].inputPath, ON_DISK);
});

test("passthroughCaseMismatch: 'warn' downgrades to a skip", async (t) => {
  createFixture();
  let cfg = await getTemplateConfigInstanceCustomCallback(
    { input: DIR, output: `${DIR}/_site` },
    ($config) => $config.configureErrorReporting({ passthroughCaseMismatch: "warn" }),
  );
  let pass = passthrough(cfg, WRONG_CASE);
  t.assert.deepStrictEqual(await pass.getFileMap(), []);
});

test("passthroughCaseMismatch: 'allow' skips silently", async (t) => {
  createFixture();
  let cfg = await getTemplateConfigInstanceCustomCallback(
    { input: DIR, output: `${DIR}/_site` },
    ($config) => $config.configureErrorReporting({ passthroughCaseMismatch: "allow" }),
  );
  let pass = passthrough(cfg, WRONG_CASE);
  t.assert.deepStrictEqual(await pass.getFileMap(), []);
});

test("A genuinely missing source is skipped, not reported as a case miss", async (t) => {
  createFixture();
  let cfg = await getTemplateConfigInstance({ dir: { input: DIR, output: `${DIR}/_site` } });
  let pass = passthrough(cfg, `./${DIR}/does-not-exist/`);
  t.assert.deepStrictEqual(await pass.getFileMap(), []);
});
