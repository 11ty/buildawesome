import test from "node:test";
import Eleventy from "../src/Core.js";

test("Eleventy addGlobalData should run once", async (t) => {
  let count = 0;
  let elev = new Eleventy("./test/stubs-addglobaldata/", "./test/stubs-addglobaldata/_site", {
    config: function ($config) {
      $config.addGlobalData("count", () => {
        count++;
        return count;
      });
    },
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(count, 1);
});

test("Eleventy addGlobalData shouldn’t run if no input templates match!", async (t) => {
  let count = 0;
  let elev = new Eleventy(
    "./test/stubs-addglobaldata-noop/",
    "./test/stubs-addglobaldata-noop/_site",
    {
      config: function ($config) {
        $config.addGlobalData("count", () => {
          count++;
          return count;
        });
      },
    }
  );

  let results = await elev.toJSON();
  t.assert.strictEqual(count, 0);
});

test("Eleventy addGlobalData can feed layouts to populate data cascade with layout data, issue #1245", async (t) => {
  let elev = new Eleventy("./test/stubs-2145/", "./test/stubs-2145/_site", {
    config: function ($config) {
      $config.addGlobalData("layout", () => "layout.njk");
      $config.dataFilterSelectors.add("LayoutData");
    },
  });

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data, { LayoutData: 123 });
  t.assert.strictEqual(result.content.trim(), "FromLayoutlayout.njk");
});

test("Eleventy addGlobalData merge data #3389", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.addGlobalData("eleventyComputed", {
        testing(data) {
          return `testing:${data.page.url}`;
        }
      });

      $config.addGlobalData("eleventyComputed", {
        other(data) {
          return `other:${data.page.url}`;
        }
      });

      $config.addTemplate("computed.njk", "{{ testing }}|{{ other }}", {})
    },
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content, "testing:/computed/|other:/computed/");
});

test("Eleventy addGlobalData merge data #3389 lodash set", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.addGlobalData("eleventyComputed.testing", () => {
        return (data) => {
          return `testing:${data.page.url}`;
        }
      });

      $config.addGlobalData("eleventyComputed.other", () => {
        return (data) => {
          return `other:${data.page.url}`;
        }
      });

      $config.addTemplate("computed.njk", "{{ testing }}|{{ other }}", {})
    },
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content, "testing:/computed/|other:/computed/");
});

test.skip("Eleventy addGlobalData merge data #3389 no nested function", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function ($config) {
      $config.addGlobalData("eleventyComputed.testing", (data) => {
        return `testing:${data.page.url}`;
      });

      $config.addGlobalData("eleventyComputed.other", (data) => {
        return `other:${data.page.url}`;
      });

      $config.addTemplate("computed.njk", "{{ testing }}|{{ other }}", {})
    },
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content, "testing:/computed/|other:/computed/");
});

