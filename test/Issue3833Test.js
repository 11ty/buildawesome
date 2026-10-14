import test from "ava";
import Eleventy from "../src/Core.js";

test("#3831 Computed Data regression", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {

      $config.addTemplate("index.njk", `---
date:
  - April 1, 2025
---`);
    }
  });
  elev.disableLogger();

  let e = await t.throwsAsync(() => elev.toJSON());
  t.is(e.message, `Data cascade value for \`date\` (April 1, 2025) is invalid for ./test/noop/index.njk. Expected a JavaScript Date instance, luxon DateTime instance, or String value.`);
});
