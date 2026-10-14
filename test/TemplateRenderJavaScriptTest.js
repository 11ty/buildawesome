import test from "ava";

import TemplateRender from "../src/TemplateRender.js";
import Eleventy from "../src/Core.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";

import { getTemplateConfigInstance } from "./_testHelpers.js";

async function getNewTemplateRender(name, inputDir, extendedConfig) {
  let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: inputDir
		}
	}, null, extendedConfig);

  eleventyConfig.setProjectUsingEsm(true);

  let tr = new TemplateRender(name, eleventyConfig);
  tr.extensionMap = new ExtensionMap(eleventyConfig);
  tr.extensionMap.engineManager = new TemplateEngineManager(eleventyConfig);
  tr.extensionMap.setFormats([]);
  await tr.init();

  return tr;
}

test("JS", async (t) => {
  t.is((await getNewTemplateRender("11ty.js")).getEngineName(), "11ty.js");
  t.is((await getNewTemplateRender("./test/stubs/filename.11ty.js")).getEngineName(), "11ty.js");
  t.is((await getNewTemplateRender("11ty.cjs")).getEngineName(), "11ty.js");
  t.is((await getNewTemplateRender("./test/stubs/filename.11ty.cjs")).getEngineName(), "11ty.js");
});

test("JS Render a string (no data)", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/string.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Bill" }), "<p>Zach</p>");
});

test("JS Render a promise (no data)", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/promise.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Bill" }), "<p>Zach</p>");
});

test("JS Render a buffer (no data)", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/buffer.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Bill" }), "<p>tést</p>");
});

test("JS Render a function", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/function.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render a function (arrow syntax)", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/function-arrow.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render a function, returns a Buffer", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/function-buffer.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "tést" }), "<p>tést</p>");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render a function (Markdown)", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/function-markdown.11ty.cjs");
  await tr.setEngineOverride("11ty.js,md");

  let fn = await tr.getCompiledTemplate();
  t.is((await fn({ name: "Zach" })).trim(), "<h1>Zach</h1>");
  t.is((await fn({ name: "Bill" })).trim(), "<h1>Bill</h1>");
});

test("JS Render a function (Collections)", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/use-collection.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(
    (
      await fn({
        collections: {
          post: [
            {
              data: {
                title: "Testing",
              },
            },
            {
              data: {
                title: "Testing2",
              },
            },
          ],
        },
      })
    ).trim(),
    `<ul><li>Testing</li><li>Testing2</li></ul>`
  );
});

test("JS Render an async function", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/function-async.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render with a Class", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/class.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>ZachBillTed</p>");
  t.is(await fn({ name: "Bill" }), "<p>BillBillTed</p>");
});

test("JS Render with a Class, returns a buffer", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/class-buffer.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zách" }), "<p>ZáchBillTed</p>");
  t.is(await fn({ name: "Zach" }), "<p>ZachBillTed</p>");
  t.is(await fn({ name: "Bill" }), "<p>BillBillTed</p>");
});

test("JS Render with a Class, async render", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/class-async.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render using Vue", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/vue.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>Hello Zach, this is a Vue template.</p>");
  t.is(await fn({ name: "Bill" }), "<p>Hello Bill, this is a Vue template.</p>");
});

test("JS Render using Vue (with a layout)", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/vue-layout.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  t.is(
    await fn({ name: "Zach" }),
    `<!doctype html>
<title>Test</title>
<p>Hello Zach, this is a Vue template.</p>`
  );
});

test("JS Render with a function", async (t) => {
  t.plan(8);

  let tr = await getNewTemplateRender("./test/stubs/function-filter.11ty.cjs", undefined, {
    javascriptFunctions: {
      upper: function (val) {
        t.is(this.page.url, "/hi/");
        // sanity check to make sure data didn’t propagate
        t.not(this.name, "Zach");
        t.not(this.name, "Bill");
        return new String(val).toUpperCase();
      },
    },
  });

  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach", page: { url: "/hi/" } }), "<p>ZACHT9000</p>");
  t.is(await fn({ name: "Bill", page: { url: "/hi/" } }), "<p>BILLT9000</p>");
});

test("JS Render with a function and async filter", async (t) => {
  t.plan(4);

  let tr = await getNewTemplateRender("./test/stubs/function-async-filter.11ty.cjs", undefined, {
    javascriptFunctions: {
      upper: function (val) {
        return new Promise((resolve) => {
          t.is(this.page.url, "/hi/");
          resolve(new String(val).toUpperCase());
        });
      },
    },
  });

  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach", page: { url: "/hi/" } }), "<p>ZACH</p>");
  t.is(await fn({ name: "Bill", page: { url: "/hi/" } }), "<p>BILL</p>");
});

test("JS Render with a function prototype", async (t) => {
  t.plan(4);
  let tr = await getNewTemplateRender("./test/stubs/function-prototype.11ty.cjs", undefined, {
    javascriptFunctions: {
      upper: function (val) {
        t.is(this.page.url, "/hi/");
        return new String(val).toUpperCase();
      },
    },
  });

  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach", page: { url: "/hi/" } }), "<p>ZACHBillT9001</p>");
  t.is(await fn({ name: "Bill", page: { url: "/hi/" } }), "<p>BILLBillT9001</p>");
});

test("JS Class Render with a function", async (t) => {
  t.plan(4);

  let tr = await getNewTemplateRender("./test/stubs/class-filter.11ty.cjs", undefined, {
    javascriptFunctions: {
      upper: function (val) {
        t.is(this.page.url, "/hi/");
        return new String(val).toUpperCase();
      },
    },
  });

  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach", page: { url: "/hi/" } }), "<p>ZACHBillTed</p>");
  t.is(await fn({ name: "Bill", page: { url: "/hi/" } }), "<p>BILLBillTed</p>");
});

test("JS Class Async Render with a function", async (t) => {
  t.plan(4);

  let tr = await getNewTemplateRender("./test/stubs/class-async-filter.11ty.cjs", undefined, {
    javascriptFunctions: {
      upper: function (val) {
        t.is(this.page.url, "/hi/");
        return new String(val).toUpperCase();
      },
    },
  });

  let fn = await tr.getCompiledTemplate();
  // Overrides all names to Ted
  t.is(await fn({ name: "Zach", page: { url: "/hi/" } }), "<p>ZACHBillTed</p>");
  t.is(await fn({ name: "Bill", page: { url: "/hi/" } }), "<p>BILLBillTed</p>");
});

test("JS Class Async Render with a function (sync function, throws error)", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/function-throws.11ty.cjs", undefined, {
    javascriptFunctions: {
      upper: function (val) {
        throw new Error("JS Class Async Render with a function (sync function, throws error)");
      },
    },
  });

  let error = await t.throwsAsync(async () => {
    let fn = await tr.getCompiledTemplate();
    await fn({ name: "Zach" });
  });
  t.true(
    error.message.indexOf("JS Class Async Render with a function (sync function, throws error)") >
      -1
  );
});

test("JS Class Async Render with a function (async function, throws error)", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/function-throws-async.11ty.cjs", undefined, {
    javascriptFunctions: {
      upper: async function (val) {
        throw new Error("JS Class Async Render with a function (async function, throws error)");
      },
    },
  });

  let error = await t.throwsAsync(async () => {
    let fn = await tr.getCompiledTemplate();
    await fn({ name: "Zach" });
  });
  t.true(
    error.message.indexOf("JS Class Async Render with a function (async function, throws error)") >
      -1
  );
});

test("JS function has access to built in filters", async (t) => {
  t.plan(6);
  let tr = await getNewTemplateRender("./test/stubs/function-fns.11ty.cjs");

  let fn = await tr.getCompiledTemplate();
  await fn({ avaTest: t, page: { url: "/hi/" } });
});

test("Class has access to built in filters", async (t) => {
  t.plan(6);
  let tr = await getNewTemplateRender("./test/stubs/class-fns.11ty.cjs");

  let fn = await tr.getCompiledTemplate();
  await fn({ avaTest: t, page: { url: "/hi/" } });
});

test("Class has page property already and keeps it", async (t) => {
  t.plan(2);
  let tr = await getNewTemplateRender("./test/stubs/class-fns-has-page.11ty.cjs");
  let fn = await tr.getCompiledTemplate();
  await fn({ avaTest: t, page: { url: "/hi/" } });
});

test("File has default function export and another one too, issue #3288", async (t) => {
  let tr = await getNewTemplateRender("./test/stubs/default-export-and-others.11ty.js");
  let fn = await tr.getCompiledTemplate();
  t.is(await fn(), "<h1>hello</h1>")
});

test("File has default class export and another one too, issue #3359", async (t) => {
  let elev = new Eleventy("./test/stubs/default-class-export-and-others.11ty.js", "");
  let results = await elev.toJSON();

  t.is(results[0].content, "<div>hello</div>")
});

test("File has default function export and another one for data too, issue #3359", async (t) => {
  let elev = new Eleventy("./test/stubs/default-function-export-and-named-data.11ty.js", "");
  let results = await elev.toJSON();

  t.is(results[0].content, "<h1>Hello World</h1>")
});

test("File has default function export and another one for data too, issue #3359 (CommonJS)", async (t) => {
  let elev = new Eleventy("./test/stubs/default-function-export-and-named-data.11ty.cjs", "");
  let results = await elev.toJSON();

  t.is(results[0].content, "<h1>Hello World</h1>")
});
