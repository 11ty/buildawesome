import test from "node:test";
import Eleventy from "../src/Core.js";

test("#3797 Virtual templates with empty includes", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.setIncludesDirectory("");
      $config.setLayoutsDirectory("_layouts");
      $config.addTemplate("post1.md", "# Post1", { layout: "layout.html" });
      $config.addTemplate("_layouts/layout.html", "{{ content }}");
    }
  });

  let [result] = await elev.toJSON();

  t.assert.ok(result);
});
