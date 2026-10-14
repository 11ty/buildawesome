import test from "ava";
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import * as sass from "sass";

import TemplateRender from "../src/TemplateRender.js";
import ExtensionMap from "../src/ExtensionMap.js";

import getNewTemplate from "./_getNewTemplateForTests.js";
import { renderTemplate } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";


async function getNewTemplateRender(name, inputDir, eleventyConfig, extensionMap) {
  if (!eleventyConfig) {
    eleventyConfig = await getTemplateConfigInstance();
  }


  if (!extensionMap) {
    extensionMap = new ExtensionMap(eleventyConfig);
    extensionMap.setFormats([]);
  }

  let mgr = new TemplateEngineManager(eleventyConfig);
  extensionMap.engineManager = mgr;

  let tr = new TemplateRender(name, eleventyConfig);
  tr.extensionMap = extensionMap;
  await tr.init();

  return tr;
}

test("Custom plaintext Render", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // addExtension() API
      cfg.addExtension("txt", {
        compile: function (str, inputPath) {
          // plaintext
          return function (data) {
            return str;
          };
        },
      });
    }
  );

  let tr = await getNewTemplateRender("txt", null, eleventyConfig);
  let fn = await tr.getCompiledTemplate("<p>Paragraph</p>");
  t.is(await fn(), "<p>Paragraph</p>");
  t.is(await fn({}), "<p>Paragraph</p>");
});

test("Custom Markdown Render with `compile` override", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // addExtension() API
      cfg.addExtension("md", {
        compile: function (str, inputPath) {
          return function (data) {
            return `<not-markdown>${str.trim()}</not-markdown>`;
          };
        },
      });
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let fn = await tr.getCompiledTemplate("# Markdown?");
  t.is((await fn()).trim(), "<not-markdown># Markdown?</not-markdown>");
  t.is((await fn({})).trim(), "<not-markdown># Markdown?</not-markdown>");
});

test("Custom Markdown Render without `compile` override", async (t) => {
  let initCalled = false;
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // addExtension() API
      cfg.addExtension("md", {
        init: function () {
          initCalled = true;
        },
      });
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let fn = await tr.getCompiledTemplate("# Header");
  t.is(initCalled, true);
  t.is((await fn()).trim(), "<h1>Header</h1>");
  t.is((await fn({})).trim(), "<h1>Header</h1>");
});

test("Custom Markdown Render with `compile` override + call to default compiler", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // addExtension() API
      cfg.addExtension("md", {
        compile: function (str, inputPath) {
          return async function (data) {
            const result = await this.defaultRenderer(data);
            return `<custom-wrapper>${result.trim()}</custom-wrapper>`;
          };
        },
      });
    }
  );

  let tr = await getNewTemplateRender("md", null, eleventyConfig);

  let fn = await tr.getCompiledTemplate("Hey {{name}}");
  t.is((await fn()).trim(), "<custom-wrapper><p>Hey</p></custom-wrapper>");
  t.is((await fn({ name: "Zach" })).trim(), "<custom-wrapper><p>Hey Zach</p></custom-wrapper>");
});

test("Custom Vue Render", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // addExtension() API
      cfg.addExtension("vue", {
        compile: function (str) {
          return async function (data) {
            const app = createSSRApp({
              template: str,
              data: function () {
                return data;
              },
            });

            return renderToString(app);
          };
        },
      });
    }
  );

  let tr = await getNewTemplateRender("vue", null, eleventyConfig);
  let fn = await tr.getCompiledTemplate('<p v-html="test">Paragraph</p>');
  t.is(await fn({ test: "Hello" }), "<p>Hello</p>");
});

test("Custom Sass Render", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // addExtension() API
      cfg.addExtension("sass", {
        compile: function (str, inputPath) {
          // TODO declare data variables as SASS variables?
          return async function (data) {
            return new Promise(function (resolve, reject) {
              sass.render(
                {
                  data: str,
                  includePaths: [tr.inputDir, tr.includesDir],
                  style: "expanded",
                  indentType: "space",
                  // TODO
                  // sourcemap: "file",
                  outFile: "test_this_is_to_not_write_a_file.css",
                },
                function (error, result) {
                  if (error) {
                    reject(error);
                  } else {
                    resolve(result.css.toString("utf8"));
                  }
                },
              );
            });
          };
        },
      });
    }
  );

  let tr = await getNewTemplateRender("sass", null, eleventyConfig);
  let fn = await tr.getCompiledTemplate("$color: blue; p { color: $color; }");
  t.is(
    (await fn({})).trim(),
    `p {
  color: blue;
}`,
  );
});

/*
serverPrefetch: function() {
    return this.getBlogAuthors().then(response => this.glossary = response)
  },
*/
test("JavaScript functions should not be mutable but not *that* mutable", async (t) => {
  t.plan(3);

  let instance = {
    dataForCascade: function () {
      // was mutating this.config.javascriptFunctions!
      this.shouldnotmutatethething = 1;
      return {};
    },
  };

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // addExtension() API
      cfg.addExtension("js1", {
        getData: ["dataForCascade"],
        getInstanceFromInputPath: function (inputPath) {
          t.truthy(true);
          return instance;
        },
        compile: function (str, inputPath) {
          t.falsy(this.config.javascriptFunctions.shouldnotmutatethething);

          // plaintext
          return (data) => {
            return str;
          };
        },
      });
    }
  );

  let tmpl = await getNewTemplate(
    "./test/stubs-custom-extension/test.js1",
    "./test/stubs-custom-extension/",
    "dist",
    null,
    null,
    eleventyConfig,
  );
  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "<p>Paragraph</p>");
});

test("Return undefined in compile to ignore #2267", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // addExtension() API
      cfg.addExtension("txt", {
        compile: function (str, inputPath) {
          return;
        },
      });
    }
  );

  let tr = await getNewTemplateRender("txt", null, eleventyConfig);
  let fn = await tr.getCompiledTemplate("<p>Paragraph</p>");
  t.is(fn, undefined);
});

test("Simple alias to Markdown Render", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addExtension("mdx", {
        key: "md",
      });
    }
  );

  let tr = await getNewTemplateRender("mdx", null, eleventyConfig);

  let fn = await tr.getCompiledTemplate("# Header");
  t.is((await fn()).trim(), "<h1>Header</h1>");
  t.is((await fn({})).trim(), "<h1>Header</h1>");
});

// NOTE: Breaking change in 3.0 `import` does not allow aliasing to non-.js file names
test.skip("Breaking Change (3.0): Simple alias to JavaScript Render", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addExtension("11ty.custom", {
        key: "11ty.js",
      });
    }
  );

  let tr = await getNewTemplateRender("./test/stubs/string.11ty.custom", null, eleventyConfig);
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Bill" }), "<p>Zach</p>");
});

// NOTE: Breaking change in 3.0 `import` does not allow aliasing to non-.js file names
test.skip("Breaking Change (3.0): Override to JavaScript Render", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addExtension("11ty.custom", {
        key: "11ty.js",
        init: function () {},
      });
    }
  );

  let tr = await getNewTemplateRender("./test/stubs/string.11ty.custom", null, eleventyConfig);
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Bill" }), "<p>Zach</p>");
});

// NOTE: Breaking change in 3.0 `import` does not allow aliasing to non-.js file names
test.skip("Breaking Change (3.0): Two simple aliases to JavaScript Render", async (t) => {
  t.plan(2);
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addExtension(["11ty.custom", "11ty.possum"], {
        key: "11ty.js", // esm
      });
    }
  );

  let map = new ExtensionMap(eleventyConfig); // reuse this
  map.setFormats([]);

  let tr = await getNewTemplateRender("./test/stubs/string.11ty.custom", null, eleventyConfig, map);
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({}), "<p>Zach</p>");

  let tr2 = await getNewTemplateRender(
    "./test/stubs/string.11ty.possum",
    null,
    eleventyConfig,
    map,
  );
  let fn2 = await tr2.getCompiledTemplate();
  t.is(await fn2({}), "<p>Possum</p>");
});

test("Double override (one simple alias to custom) works fine", async (t) => {
  t.plan(3);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addExtension(["11ty.possum"], {
        init: function () {
          t.true(true);
        },
        compile: function(content, inputPath) {
          t.true(true);
          return (data) => "Appended " + content;
        }
      });

      cfg.addExtension(["customhtml"], {
        key: "11ty.possum",
      });
    }
  );

  let map = new ExtensionMap(eleventyConfig); // reuse this
  // map.setFormats(["11ty.possum", "11ty.custom"]);
  map.setFormats(["customhtml"]);

  let tr = await getNewTemplateRender(
    "customhtml",
    null,
    eleventyConfig,
    map,
  );

  let fn = await tr.getCompiledTemplate("Template content");
  t.is(await fn({}), "Appended Template content");
});


test("Double override (two simple aliases)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addExtension(["11ty.possum"], {
        key: "html",
      });

      cfg.addExtension(["customhtml"], {
        key: "11ty.possum",
      });
    }
  );

  let map = new ExtensionMap(eleventyConfig); // reuse this
  // map.setFormats(["11ty.possum", "11ty.custom"]);
  map.setFormats(["customhtml"]);

  let tr = await getNewTemplateRender(
    "customhtml",
    null,
    eleventyConfig,
    map,
  );

  let fn = await tr.getCompiledTemplate("Template content");
  t.is(await fn({}), "Template content");
});

test("Double override (two complex aliases) is supported as of 3.0", async (t) => {
  t.plan(5);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addExtension(["possum"], {
        key: "html",
        init: function () {
          t.true(true);
        },
        compile: function() {
          t.true(true);
          return async function(data) {
            const result = await this.defaultRenderer(data);
            return `possum|${result}`;
          };
        }
      });

      cfg.addExtension(["11ty.custom"], {
        key: "possum",
        init: function () {
          t.true(true);
        },
        compile: function() {
          t.true(true);
          return async function(data) {
            const result = await this.defaultRenderer(data);
            return `11ty.custom|${result}`;
          };
        }
      });
    }
  );

  let map = new ExtensionMap(eleventyConfig); // reuse this
  map.setFormats(["possum", "11ty.custom"]);

  let tr = await getNewTemplateRender(
    "11ty.custom",
    null,
    eleventyConfig,
    map,
  );

  let fn = await tr.getCompiledTemplate("Template content");
  t.is(await fn({}), "11ty.custom|possum|Template content");
});

test("Double override (not aliases) throws an error", async (t) => {
  await t.throwsAsync(
    async () => {
      await getTemplateConfigInstanceCustomCallback(
        {},
        function(cfg) {
          cfg.addExtension(["md"], {
            compile: function (inputContent, inputPath) {
              return () => inputContent;
            },
          });

          cfg.addExtension(["md"], {
            compile: function (inputContent, inputPath) {
              return () => inputContent;
            },
          });
        }
      );
    },
    {
      message:
        'An attempt was made to override the "md" template syntax twice (via the `addExtension` configuration API). A maximum of one override is currently supported.',
    },
  );
});
