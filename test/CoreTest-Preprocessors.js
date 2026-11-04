import test from "node:test";
import Eleventy from "../src/Core.js";

test("#188: Content preprocessing (dot in file extension)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPreprocessor("drafts", ".njk", (data, content) => {
        if(data.draft) {
          return false;
        }
        return `Hello ${content}`;
      });

      $config.addTemplate("index.njk", "Before");
      $config.addTemplate("draft.njk", "Before", { draft: true });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content, `Hello Before`);
});

test("#188: Content preprocessing (no dot in file extension)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPreprocessor("drafts", "njk", (data, content) => {
        if(data.draft) {
          return false;
        }
        return `Hello ${content}`;
      });

      $config.addTemplate("index.njk", "Before");
      $config.addTemplate("draft.njk", "Before", { draft: true });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content, `Hello Before`);
});


test("#188: Content preprocessing (array, no dot in file extension)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPreprocessor("drafts", ["njk"], (data, content) => {
        if(data.draft) {
          return false;
        }
        return `Hello ${content}`;
      });

      $config.addTemplate("index.njk", "Before");
      $config.addTemplate("draft.njk", "Before", { draft: true });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content, `Hello Before`);
});

test("#188: Content preprocessing (array, dot in file extension)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPreprocessor("drafts", [".njk"], (data, content) => {
        if(data.draft) {
          return false;
        }
        return `Hello ${content}`;
      });

      $config.addTemplate("index.njk", "Before");
      $config.addTemplate("draft.njk", "Before", { draft: true });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content, `Hello Before`);
});

test("#188: Content preprocessing (wildcard)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPreprocessor("drafts", "*", (data, content) => {
        if(data.draft) {
          return false;
        }
        return `Hello ${content}`;
      });

      $config.addTemplate("index.njk", "Before");
      $config.addTemplate("draft.njk", "Before", { draft: true });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content, `Hello Before`);
});


test("addPreprocessor with 11ty.js, Issue #3433", async (t) => {
  t.plan(5);

  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPreprocessor("testing", "11ty.js", (data, content) => {
        t.assert.strictEqual( typeof content, "function" );
        t.assert.strictEqual(content(), "Hello!");

        return {
          render: function() {
            return "naw";
          }
        };
      });

      $config.addTemplate("template.11ty.js", function() {
        return "Hello!"
      });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].url, `/template/`);
  t.assert.strictEqual(results[0].content.trim(), `naw`);
});


test("addPreprocessor and addExtension, Issue #3433", async (t) => {
  t.plan(5);

  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addTemplateFormats("11ty.test");
      $config.addExtension("11ty.test", {
        key: "11ty.js",
      });

      $config.addPreprocessor("testing", "11ty.test", (data, content) => {
        t.assert.strictEqual( typeof content, "function" );
        t.assert.strictEqual(content(), "Hello!");

        return {
          render: function() {
            return "naw";
          }
        };
      });

      $config.addTemplate("template.11ty.test", function() {
        return "Hello!"
      });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].url, `/template/`);
  t.assert.strictEqual(results[0].content.trim(), `naw`);
});

test("addPreprocessor and addExtension with custom `compile` (defaultRenderer), Issue #3433", async (t) => {
  t.plan(5);

  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addTemplateFormats("11ty.test");
      $config.addExtension("11ty.test", {
        key: "11ty.js",
        compile: function() {
          return this.defaultRenderer;
        }
      });

      $config.addPreprocessor("testing", "11ty.test", (data, content) => {
        t.assert.strictEqual( typeof content, "function" );
        t.assert.strictEqual(content(), "Hello!");

        return {
          render: function() {
            return "naw";
          }
        };
      });

      $config.addTemplate("template.11ty.test", function() {
        return "Hello!"
      });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].url, `/template/`);
  t.assert.strictEqual(results[0].content.trim(), `naw`);
});

test("addPreprocessor and addExtension with custom `compile` (re-use render function directly), Issue #3433", async (t) => {
  t.plan(5);

  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addTemplateFormats("11ty.test");
      $config.addExtension("11ty.test", {
        key: "11ty.js",
        compile: function(content) {
          return function() {
            return content.render();
          }
        }
      });

      $config.addPreprocessor("testing", "11ty.test", (data, content) => {
        t.assert.strictEqual( typeof content, "function" );
        t.assert.strictEqual(content(), "Hello!");

        return {
          render: function() {
            return "naw";
          }
        };
      });

      $config.addTemplate("template.11ty.test", function() {
        return "Hello!"
      });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].url, `/template/`);
  t.assert.strictEqual(results[0].content.trim(), `naw`);
});

test("addPreprocessor and addExtension with custom `compile` (new render function), Issue #3433", async (t) => {
  t.plan(7);

  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addTemplateFormats("11ty.test");
      $config.addExtension("11ty.test", {
        key: "11ty.js",
        compile: function(content) {
          // check preprocessor override
          t.assert.strictEqual( typeof content.render, "function" );
          t.assert.strictEqual(content.render(), "Preprocessor override");

          return function() {
            return "Compiled content";
          }
        }
      });

      $config.addPreprocessor("testing", "11ty.test", (data, content) => {
        // check template content directly
        t.assert.strictEqual( typeof content, "function" );
        t.assert.strictEqual(content(), "Original template content");

        return {
          render: function() {
            return "Preprocessor override";
          }
        };
      });

      $config.addTemplate("template.11ty.test", function() {
        return "Original template content"
      });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].url, `/template/`);
  t.assert.strictEqual(results[0].content.trim(), `Compiled content`);
});

// #3933
test("Tags in pages excluded with preprocessing should not populate collections props", async (t) => {
  let preprocessorRuns = 0;
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPreprocessor("drafts", "njk", (data, content) => {
        preprocessorRuns++;
        if(data.draft) {
          return false;
        }
        return `Hello ${content}`;
      });

      $config.addTemplate("paged.njk", "{{ tag }}", {
        pagination: {
          data: "collections",
          size: 1,
          alias: "tag",
          filter: ["all"],
        },
        permalink: "/{{ tag }}/"
      });
      $config.addTemplate("source.njk", "Before", { tags: ["yep"] });
      $config.addTemplate("source-draft.njk", "Before", { draft: true, tags: ["nope"] });
    }
  });

  let results = await elev.toJSON();
  t.assert.strictEqual(preprocessorRuns, 3);
  t.assert.strictEqual(results.length, 2);
  t.assert.ok(results.find(entry => entry.inputPath.endsWith("source.njk")));
  t.assert.ok(!(results.find(entry => entry.inputPath.endsWith("source-draft.njk"))));

  let pages = results.filter(entry => entry.inputPath.endsWith("paged.njk"));
  t.assert.strictEqual(pages.length, 1);
  t.assert.strictEqual(pages[0].content, "Hello yep");
});

test("#4292: Preprocessors should only run once per build (bug running twice during incremental and config reset)", async (t) => {
  t.plan(3);

  let preprocessorRuns = 0;
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPreprocessor("drafts", ".njk", (data, content) => {
        preprocessorRuns++;
        return `Hello ${content} Suffix`;
      });

      $config.addTemplate("index.njk", "Before");
    }
  });

  await elev.toJSON();

  elev.setIncrementalFiles("./test/stubs-virtual/eleventy.config.js");

  let results = await elev.toJSON();

  t.assert.strictEqual(results.length, 1);
  t.assert.strictEqual(results[0].content, `Hello Before Suffix`);
  t.assert.strictEqual(preprocessorRuns, 2);
});

test("#4292: Preprocessors mutable data", async (t) => {
  t.plan(9);

  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPreprocessor("drafts", ".njk", (data, content) => {
        t.assert.strictEqual(data.title, "Title");
        data.title += " (draft)";
        t.assert.strictEqual(data.title, "Title (draft)");
        t.assert.strictEqual(content, "Hello {{title}} Suffix");

        return content;
      });

      $config.addTemplate("index.njk", "Hello {{title}} Suffix", {
        title: "Title"
      });
    }
  });

  elev.setIncrementalFiles(["./test/stubs-virtual/_includes/yo.njk"]);
  let results1 = await elev.toJSON();
  t.assert.strictEqual(results1[0].content, `Hello Title (draft) Suffix`);

  elev.setIncrementalFiles(["./test/stubs-virtual/index.njk"]);
  let results2 = await elev.toJSON();
  t.assert.strictEqual(results2.length, 1);
  t.assert.strictEqual(results2[0].content, `Hello Title (draft) Suffix`);
});
