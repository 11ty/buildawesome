import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import Eleventy from "../src/Core.js";

const ROOT = "./test/_generated/incremental-glob/";

function createProject(t) {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT + "sub", { recursive: true });
  t.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

  fs.writeFileSync(ROOT + "eleventy.config.js", "export default function($config) {};");
  fs.writeFileSync(ROOT + "one.md", "{% rendered %}One");
  fs.writeFileSync(ROOT + "two.md", "{% rendered %}Two");
  fs.writeFileSync(ROOT + "sub/three.md", "{% rendered %}Three");
  fs.writeFileSync(ROOT + "four.njk", "{% rendered %}Four");
}

// Returns the input paths that were actually rendered for the incremental build
async function getRenderedFiles(incrementalFiles) {
  let rendered = new Set();
  let elev = new Eleventy(ROOT, ROOT + "_site", {
    configPath: ROOT + "eleventy.config.js",
    config($config) {
      $config.addShortcode("rendered", function () {
        rendered.add(path.relative(ROOT, this.page.inputPath).split(path.sep).join("/"));
        return "";
      });
    },
  });
  elev.disableLogger();
  elev.setIncrementalFiles(incrementalFiles);
  await elev.toJSON();

  return Array.from(rendered).sort();
}

test("#4441 --incremental with a glob pattern", async (t) => {
  createProject(t);

  t.assert.deepStrictEqual(await getRenderedFiles(ROOT + "**/*.md"), [
    "one.md",
    "sub/three.md",
    "two.md",
  ]);
});

test("#4441 --incremental with a glob pattern and a file path", async (t) => {
  createProject(t);

  t.assert.deepStrictEqual(await getRenderedFiles(`${ROOT}sub/*.md,${ROOT}four.njk`), [
    "four.njk",
    "sub/three.md",
  ]);
});

test("#4441 --incremental glob with a negated pattern", async (t) => {
  createProject(t);

  t.assert.deepStrictEqual(await getRenderedFiles([`${ROOT}**/*.md`, `!${ROOT}sub/**`]), [
    "one.md",
    "two.md",
  ]);
});

test("#4441 --incremental glob that matches nothing renders everything", async (t) => {
  createProject(t);

  t.assert.deepStrictEqual(await getRenderedFiles(ROOT + "**/*.liquid"), [
    "four.njk",
    "one.md",
    "sub/three.md",
    "two.md",
  ]);
});
