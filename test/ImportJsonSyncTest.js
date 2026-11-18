import test from "node:test";
import { TemplatePath } from "@11ty/eleventy-utils";
import { tmpdir } from "node:os";
import {
  importJsonSync,
  findFilePathInParentDirs,
  getModulePackageJson,
  getWorkingProjectPackageJson,
} from "../src/Util/ImportJsonSync.js";

test("Import a JSON", t => {
  t.assert.deepStrictEqual(Object.keys(importJsonSync("../../package.json")).sort().slice(-2, -1).pop(), "version");
});

test("getWorkingProjectPackageJson() traverse parent dirs", t => {
  let path = findFilePathInParentDirs(TemplatePath.absolutePath("test"), "package.json");
  let json = importJsonSync(path);
  t.assert.deepStrictEqual(Object.keys(json).sort().slice(-2, -1).pop(), "version");
});

test("getModulePackageJson() traverse parent dirs", t => {
  t.assert.strictEqual(getModulePackageJson("test/stubs").name, "@11ty/eleventy");
});

test("getModulePackageJson() outside the working directory", t => {
  t.assert.deepStrictEqual(getModulePackageJson(tmpdir()), {});
});

test("getWorkingProjectPackageJson()", t => {
  t.assert.strictEqual(getWorkingProjectPackageJson().name, "@11ty/eleventy");
});
