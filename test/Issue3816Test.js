import markdownIt from "markdown-it";
import markdownItAbbr from "markdown-it-abbr";

import test from "ava";
import Eleventy from "../src/Core.js";

test("#3816 amendLibrary and setLibrary together", async (t) => {
  t.plan(1);

  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addTemplate("index.md", "# Heading");
      $config.setLibrary("md", markdownIt());
      $config.amendLibrary("md", (mdLib) => {
        // this will only run once, t.plan is important!
        let before = mdLib.core.ruler.getRules("").length;
        mdLib.use(markdownItAbbr);
        let after = mdLib.core.ruler.getRules("").length;
        t.is(after, before + 1);
      });
    }
  });


  await elev.toJSON();
  await elev.restart();
  await elev.toJSON();
  await elev.restart();
  await elev.toJSON();
  await elev.restart();
});
