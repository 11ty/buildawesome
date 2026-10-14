import test from "ava";
import Eleventy from "../src/Core.js";

test.skip("#3400: Both a paired and unpaired shortcode.", async (t) => {
  let count = 0;
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function($config) {
      $config.addShortcode("single", function() {
        count++;
      });
      $config.addPairedShortcode("single", function() {
        count++;
      });

      $config.addTemplate("test.njk", `{% single %}
{% single %}{% endsingle %}`, {});
    }
  });

  let results = await elev.toJSON();
  t.is(count, 2);
});
