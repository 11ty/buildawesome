import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import Eleventy from "../src/Core.js";

const DIR = "test/_generated/passthrough-config-mkdir";

// Writes a project whose config callback creates the passthrough directory while it runs, so no
// `dist/` exists when Eleventy lists the project folder to find the config file. `dist/` sits beside
// the input directory (not inside it) so template globbing never refreshes the project folder listing.
function createProject() {
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIR, "src"), { recursive: true });
  fs.writeFileSync(path.join(DIR, "src/index.html"), "<p>index</p>");
  fs.writeFileSync(
    path.join(DIR, "eleventy.config.js"),
    `import { mkdirSync, writeFileSync } from "node:fs";
export default function ($config) {
  mkdirSync("${DIR}/dist/js", { recursive: true });
  writeFileSync("${DIR}/dist/js/a.js", "x");
  $config.addPassthroughCopy({ "${DIR}/dist/": "/" });
}
`,
  );
}

test.after(() => {
  fs.rmSync(DIR, { recursive: true, force: true });
});

test("Passthrough copy keeps the directory tree when the config callback created it", async (t) => {
  createProject();

  let outputDir = `${DIR}/_site`;
  let elev = new Eleventy(`${DIR}/src`, outputDir, {
    configPath: `${DIR}/eleventy.config.js`,
  });
  elev.disableLogger();
  await elev.init();
  await elev.write();

  t.assert.strictEqual(fs.existsSync(path.join(outputDir, "js/a.js")), true);
  t.assert.strictEqual(fs.existsSync(path.join(outputDir, "a.js")), false);
});
