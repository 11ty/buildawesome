import test from "ava";
import fs from "node:fs";
import Eleventy from "../../src/Core.js";

// This tests Eleventy Watch and the file system!

test("#3807 Nunjucks cacheable should be reused when Nunjucks is the preprocessor language", async (t) => {
  let runs = [
    {
      ...Promise.withResolvers(),
      input: `<html>first{% block main %}{{ content | safe }}{% endblock %}</html>`,
      expected: `<html>firstHome<p>Index</p></html>`,
    },
    {
      ...Promise.withResolvers(),
      input: `<html>second{% block main %}{{ content | safe }}{% endblock %}</html>`,
      expected: `<html>secondHome<p>Index</p></html>`,
    },
    {
      ...Promise.withResolvers(),
      input: `<html>third{% block main %}{{ content | safe }}{% endblock %}</html>`,
      expected: `<html>thirdHome<p>Index</p></html>`,
    }
  ];

  t.plan(runs.length + 1);

  // Restore original content
  const ORIGINAL_CONTENT = `<html>{% block main %}{{ content | safe }}{% endblock %}</html>`;
  fs.writeFileSync("test/stubs-3807/_layouts/base.html", ORIGINAL_CONTENT, "utf8");

  let index = 0;
  let elev = new Eleventy("test/stubs-3807/", "test/stubs-3807/_site", {
    configPath: "test/stubs-3807/eleventy.config.js",
    config($config) {
      $config.on("buildawesome.afterwatch", () => {
        let {resolve} = runs[index];
        index++;
        resolve();
      });
    }
  });

  elev.disableLogger();
  await elev.init();
  await elev.watch();

  // Control
  let content = fs.readFileSync("test/stubs-3807/_site/index.html", "utf8");
  t.is(content, `<html>Home<p>Index</p></html>`);

  // Stop after all runs are complete
  Promise.all(runs.map(entry => entry.promise)).then(async () => {
    await elev.stopWatch();
  });

  for(let run of runs) {
    fs.writeFileSync("test/stubs-3807/_layouts/base.html", run.input, "utf8");
    await run.promise;

    let content = fs.readFileSync("test/stubs-3807/_site/index.html", "utf8");
    t.is(content, run.expected);
  }

  fs.writeFileSync("test/stubs-3807/_layouts/base.html", ORIGINAL_CONTENT, "utf8");
  fs.rmSync("test/stubs-3807/_site", { recursive: true });
});