import test from "ava";
import { TemplatePath } from "@11ty/eleventy-utils";
import { importJsonSync, findFilePathInParentDirs } from "../src/Util/ImportJsonSync.js";

test("Import a JSON", t => {
  t.deepEqual(Object.keys(importJsonSync("../../package.json")).sort().slice(-2, -1).pop(), "version");
});

test("getWorkingProjectPackageJson() traverse parent dirs", t => {
  let path = findFilePathInParentDirs(TemplatePath.absolutePath("test"), "package.json");
  let json = importJsonSync(path);
  t.deepEqual(Object.keys(json).sort().slice(-2, -1).pop(), "version");
});
