import test from "node:test";
import Eleventy from "../src/Core.js";

test.skip("#3794: page.inputPathDir and page.dir", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function($config) {
      $config.addTemplate("test.njk", `{{ page.inputPathDir }} and {{ page.dir }}`, {});
    }
  });

  let [result] = await elev.toJSON();
  t.assert.strictEqual(result.content, "./test/stubs-virtual/ and /test/");
});

test.skip("#3794: page.inputPathDir and page.dir (index file)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function($config) {
      $config.addTemplate("index.njk", `{{ page.inputPathDir }} and {{ page.dir }}`, {});
    }
  });

  let [result] = await elev.toJSON();
  t.assert.strictEqual(result.content, "./test/stubs-virtual/ and /");
});

test.skip("#3794: page.inputPathDir and page.dir (paginated)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function($config) {
      $config.addTemplate("index.njk", `{{ page.inputPathDir }} and {{ page.dir }}`, {
        data: [1,2,3],
        pagination: {
          data: "data",
          size: 1,
        }
      });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 3);

  let [page1, page2, page3]  = results;
  t.assert.strictEqual(page1.content, "./test/stubs-virtual/ and /");
  t.assert.strictEqual(page2.content, "./test/stubs-virtual/ and /1/");
  t.assert.strictEqual(page3.content, "./test/stubs-virtual/ and /2/");
});

test.skip("#3794: page.inputPathDir and page.dir (with file slug and index)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function($config) {
      $config.addTemplate("yawn/index.njk", `{{ page.inputPathDir }} and {{ page.dir }}`, {
        permalink: "{{ page.filePathStem }}.{{ page.outputFileExtension }}"
      });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);

  let [page1]  = results;
  t.assert.strictEqual(page1.content, "./test/stubs-virtual/yawn/ and /yawn/");
});

test.skip("#3794: page.inputPathDir and page.dir (with file slug and not-index)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function($config) {
      $config.addTemplate("yawn/test.njk", `{{ page.inputPathDir }} and {{ page.dir }}`, {
        permalink: "{{ page.filePathStem }}.{{ page.outputFileExtension }}"
      });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);

  let [page1]  = results;
  t.assert.strictEqual(page1.content, "./test/stubs-virtual/yawn/ and /yawn/");
});

test.skip("#3794: page.inputPathDir and page.dir (paginated with file slug and not-index)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function($config) {
      $config.addTemplate("yawn/test.njk", `{{ page.inputPathDir }} and {{ page.dir }}`, {
        data: [1,2,3],
        pagination: {
          data: "data",
          size: 1,
        },
        permalink: "/{{ pagination.pageNumber }}{{ page.filePathStem }}.{{ page.outputFileExtension }}"
      });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 3);

  let [page1, page2, page3]  = results;
  t.assert.strictEqual(page1.content, "./test/stubs-virtual/yawn/ and /0/yawn/");
  t.assert.strictEqual(page2.content, "./test/stubs-virtual/yawn/ and /1/yawn/");
  t.assert.strictEqual(page3.content, "./test/stubs-virtual/yawn/ and /2/yawn/");
});

test.skip("#3794: page.inputPathDir and page.dir (permalink: false)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: function($config) {
      $config.addTemplate("index.njk", `{{ page.inputPathDir }} and {{ page.dir }}`, { permalink: false });
    }
  });

  let [result] = await elev.toJSON();
  t.assert.strictEqual(result.content, "./test/stubs-virtual/ and false");
});
