import test from "node:test";
import { TemplatePath } from "@11ty/eleventy-utils";
import { importJsonSync, findFilePathInParentDirs } from "../src/Util/ImportJsonSync.js";

test("Import a JSON", t => {
  t.assert.deepStrictEqual(Object.keys(importJsonSync("../../package.json")).sort().slice(-2, -1).pop(), "version");
});

test("getWorkingProjectPackageJson() traverse parent dirs", t => {
  let path = findFilePathInParentDirs(TemplatePath.absolutePath("test"), "package.json");
  let json = importJsonSync(path);
  t.assert.deepStrictEqual(Object.keys(json).sort().slice(-2, -1).pop(), "version");
});
