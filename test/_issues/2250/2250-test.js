import test from "ava";
import Eleventy from "../../../src/Core.js";

test("Issue #2250, page is available in filters", async (t) => {
  let elev = new Eleventy("./test/_issues/2250/", "./test/_issues/2250/_site", {
    config: function ($config) {
      $config.addFilter("getUrl", function () {
        return this.page.url;
      });
    },
  });

  let results = await elev.toJSON();
  let nunjucks = results.filter((entry) => {
    return entry.url.startsWith("/nunjucks/");
  });

  t.is(nunjucks[0].content.trim(), "/nunjucks/");

  let liquid = results.filter((entry) => {
    return entry.url.startsWith("/liquid/");
  });

  t.is(liquid[0].content.trim(), "/liquid/");

  let javascript = results.filter((entry) => {
    return entry.url.startsWith("/javascript/");
  });

  t.is(javascript[0].content.trim(), "/javascript/");
});
