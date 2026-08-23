import test from "ava";
import Nunjucks from "@11ty/nunjucks";

import TemplateRender from "../src/TemplateRender.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";

import { normalizeNewLines } from "./Util/normalizeNewLines.js";
import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

async function getNewTemplateRender(name, inputDir, eleventyConfig) {
  if (!eleventyConfig) {
    eleventyConfig = await getTemplateConfigInstance({
      dir: {
        input: inputDir
      }
    });
  }

  let tr = new TemplateRender(name, eleventyConfig);
  tr.extensionMap = new ExtensionMap(eleventyConfig);
  tr.extensionMap.engineManager = new TemplateEngineManager(eleventyConfig);
  tr.extensionMap.setFormats([]);
  await tr.init();
  return tr;
}

async function getPromise(resolveTo) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(resolveTo);
    });
  });
}

// Nunjucks
test("Nunjucks", async (t) => {
  let tr = await getNewTemplateRender("njk");
  t.is(tr.getEngineName(), "njk");
});

test("Nunjucks Render", async (t) => {
  let tr = await getNewTemplateRender("njk");
  let fn = await tr.getCompiledTemplate("<p>{{ name }}</p>");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Nunjucks Render Addition", async (t) => {
  let tr = await getNewTemplateRender("njk");
  let fn = await tr.getCompiledTemplate("<p>{{ number + 1 }}</p>");
  t.is(await fn({ number: 1 }), "<p>2</p>");
});

test("Nunjucks Render Extends", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let fn = await tr.getCompiledTemplate(
    "{% extends 'base.njk' %}{% block content %}This is a child.{% endblock %}"
  );
  t.is(await fn(), "<p>This is a child.</p>");
});

test("Nunjucks Render Relative Extends", async (t) => {
  let tr = await getNewTemplateRender(
    "./test/stubs/njk-relative/dir/does_not_exist_and_thats_ok.njk",
    "test/stubs"
  );
  let fn = await tr.getCompiledTemplate(
    "{% extends '../dir/base.njk' %}{% block content %}This is a child.{% endblock %}"
  );
  t.is(await fn(), "<p>This is a child.</p>");
});

test("Nunjucks Render Include", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let fn = await tr.getCompiledTemplate("<p>{% include 'included.njk' %}</p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Nunjucks Render Include (different extension)", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let fn = await tr.getCompiledTemplate("<p>{% include 'included.nunj' %}</p>");
  t.is(await fn(), "<p>Nunjabusiness</p>");
});

test("Nunjucks Render Include (different extension, subdir)", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let fn = await tr.getCompiledTemplate("<p>{% include 'subfolder/included.nunj' %}</p>");
  t.is(await fn(), "<p>Nunjabusiness2</p>");
});

test("Nunjucks Render Relative Include Issue #190", async (t) => {
  let tr = await getNewTemplateRender(
    "./test/stubs/njk-relative/does_not_exist_and_thats_ok.njk",
    "./test/stubs"
  );
  let fn = await tr.getCompiledTemplate("<p>{% include './dir/included.njk' %}</p>");
  t.is(await fn(), "<p>HELLO FROM THE OTHER SIDE.</p>");
});

test("Nunjucks Render Relative Include (using ..) Issue #190", async (t) => {
  let tr = await getNewTemplateRender(
    "./test/stubs/njk-relative/dir/does_not_exist_and_thats_ok.njk",
    "./test/stubs"
  );
  let fn = await tr.getCompiledTemplate("<p>{% include '../dir/included.njk' %}</p>");
  t.is(await fn(), "<p>HELLO FROM THE OTHER SIDE.</p>");

  // should look in _includes too, related to Issue #633
  let fn2a = await tr.getCompiledTemplate("<p>{% include 'included-relative.njk' %}</p>");
  t.is(await fn2a(), "<p>akdlsjafkljdskl</p>");

  // should look in _includes too Issue #633
  // let fn3 = await tr.getCompiledTemplate(
  //   "<p>{% include '../_includes/included-relative.njk' %}</p>"
  // );
  // t.is(await fn3(), "<p>akdlsjafkljdskl</p>");
});

test("Nunjucks Render Relative Include (using current dir) Issue #190", async (t) => {
  let tr = await getNewTemplateRender(
    "./test/stubs/njk-relative/dir/does_not_exist_and_thats_ok.njk",
    "./test/stubs"
  );
  let fn = await tr.getCompiledTemplate("<p>{% include './included.njk' %}</p>");
  t.is(await fn(), "<p>HELLO FROM THE OTHER SIDE.</p>");

  // This fails because ./ doesn’t look in _includes (this is good)
  // let fn = await tr.getCompiledTemplate(
  //   "<p>{% include './included-relative.njk' %}</p>"
  // );
  // t.is(await fn(), "<p>akdlsjafkljdskl</p>");
});

test("Nunjucks Render Relative Include (ambiguous path, file exists in _includes and in current dir) Issue #190", async (t) => {
  let tr = await getNewTemplateRender(
    "./test/stubs/njk-relative/dir/does_not_exist_and_thats_ok.njk",
    "./test/stubs"
  );
  let fn = await tr.getCompiledTemplate(
    // should prefer to use _includes first
    // more specifically, this will not use the current dir at all.
    "<p>{% include 'included.njk' %}</p>"
  );
  t.is(await fn(), "<p>This is an include.</p>");

  // This fails, a leading dot is required for a relative include
  // let tr2 = getNewTemplateRender("./test/stubs/njk-relative/dir/does_not_exist_and_thats_ok.njk", "./test/stubs");
  // let fn2 = await tr.getCompiledTemplate(
  //   "<p>{% include 'unique-include-123.njk' %}</p>"
  // );
  // t.is(await fn2(), "<p>HELLO FROM THE OTHER SIDE.</p>");
});

test("Nunjucks Async Filter", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let engine = tr.engine;
  engine.addFilters(
    {
      myAsyncFilter: function (value, callback) {
        setTimeout(function () {
          callback(null, `HI${value}`);
        }, 100);
      },
    },
    true
  );
  let fn = await tr.getCompiledTemplate("{{ 'test' | myAsyncFilter }}");
  t.is((await fn()).trim(), "HItest");
});

test("Nunjucks Render set with a filter", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let engine = tr.engine;
  engine.addFilters({
    uppercase: function (str) {
      return str.toUpperCase();
    },
  });
  let fn = await tr.getCompiledTemplate(`{% set test = "hi" | uppercase %}{{ test }}`);
  t.is((await fn()).trim(), `HI`);
});

test("Nunjucks Render Include a JS file (Issue 398)", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let engine = tr.engine;
  engine.addFilters({
    jsmin: function (str) {
      return str;
    },
  });
  let fn = await tr.getCompiledTemplate(
    "{% set ga %}{% include 'test.js' %}{% endset %}{{ ga | safe | jsmin }}"
  );
  t.is((await fn()).trim(), `/* THIS IS A COMMENT */ alert("Issue #398");`);
});

test("Nunjucks Render Include Subfolder", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let fn = await tr.getCompiledTemplate("<p>{% include 'subfolder/included.html' %}</p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Nunjucks Render Include Double Quotes", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let fn = await tr.getCompiledTemplate(`<p>{% include "included.njk" %}</p>`);
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Nunjucks Render Include Subfolder Double Quotes", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let fn = await tr.getCompiledTemplate(`<p>{% include "subfolder/included.html" %}</p>`);
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Nunjucks Render Imports", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let fn = await tr.getCompiledTemplate(
    "{% import 'imports.njk' as forms %}<div>{{ forms.label('Name') }}</div>"
  );
  t.is(await fn(), "<div><label>Name</label></div>");
});

test("Nunjucks Render Relative Imports", async (t) => {
  let tr = await getNewTemplateRender(
    "./test/stubs/njk-relative/dir/does_not_exist_and_thats_ok.njk",
    "test/stubs"
  );
  let fn = await tr.getCompiledTemplate(
    "{% import '../dir/imports.njk' as forms %}<div>{{ forms.label('Name') }}</div>"
  );
  t.is(await fn(), "<div><label>Name</label></div>");
});

test("Nunjucks Render Imports From", async (t) => {
  let tr = await getNewTemplateRender("njk", "test/stubs");
  let fn = await tr.getCompiledTemplate(
    "{% from 'imports.njk' import label %}<div>{{ label('Name') }}</div>"
  );
  t.is(await fn(), "<div><label>Name</label></div>");
});

test("Nunjucks getEngineLib", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  t.truthy(tr.engine.getEngineLib());
});

test("Nunjucks Render: with Library Override", async (t) => {
  let tr = await getNewTemplateRender("njk");

  let env = new Nunjucks.Environment(new Nunjucks.FileSystemLoader("./test/stubs/_includes/"));
  tr.engine.setLibrary(env);

  let fn = await tr.getCompiledTemplate("<p>{{ name }}</p>");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Nunjucks Render with getGlobals Issue #567", async (t) => {
  let tr = await getNewTemplateRender("njk");
  let env = tr.engine.getEngineLib();
  env.addGlobal("getGlobals", function () {
    return this.getVariables();
  });

  let fn = await tr.getCompiledTemplate("<p>{{ getGlobals()['my-global-name'] }}</p>");
  t.is(await fn({ "my-global-name": "Zach" }), "<p>Zach</p>");
});

test("Nunjucks Render with getVarFromString Filter Issue #567", async (t) => {
  let tr = await getNewTemplateRender("njk");
  let env = tr.engine.getEngineLib();
  env.addFilter("getVarFromString", function (varName) {
    return this.getVariables()[varName];
  });

  let fn = await tr.getCompiledTemplate("<p>{{ 'my-global-name' | getVarFromString }}</p>");
  t.is(await fn({ "my-global-name": "Zach" }), "<p>Zach</p>");
});

test("Nunjucks Shortcode without args #372", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function (arg1) {
    return arg1 + "Zach";
  });

  t.is(await tr._testRender("{% postfixWithZach %}", {}), "undefinedZach");
});

test("Nunjucks Shortcode", async (t) => {
  t.plan(3);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function (str) {
    // Data in context
    t.is(this.page.url, "/hi/");
    // sanity check that all data is not carried forward
    t.not(this.name, "test");

    return str + "Zach";
  });

  t.is(
    await tr._testRender("{% postfixWithZach name %}", {
      name: "test",
      page: {
        url: "/hi/",
      },
    }),
    "testZach"
  );
});

test("Nunjucks Async Shortcode", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode(
    "postfixWithZach",
    async function (str) {
      // Data in context
      t.is(this.page.url, "/hi/");

      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(str + "Zach");
        });
      });
    },
    true
  );

  t.is(
    await tr._testRender("{% postfixWithZach name %}", {
      name: "test",
      page: {
        url: "/hi/",
      },
    }),
    "testZach"
  );
});

test("Nunjucks Async function Shortcode", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode(
    "postfixWithZach",
    async function (str) {
      // Data in context
      t.is(this.page.url, "/hi/");

      return await getPromise(str + "Zach");
    },
    true
  );

  t.is(
    await tr._testRender("{% postfixWithZach name %}", {
      name: "test",
      page: {
        url: "/hi/",
      },
    }),
    "testZach"
  );
});

test("Nunjucks sync function Shortcode (error throwing)", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode(
    "postfixWithZach",
    function (str) {
      throw new Error("Nunjucks sync function Shortcode (error throwing)");
    },
    false
  );

  let error = await t.throwsAsync(async () => {
    await tr._testRender("{% postfixWithZach name %}", { name: "test" });
  });

  t.true(
    error.message.indexOf(
      "BuildAwesomeNunjucksError: Error with Nunjucks shortcode `postfixWithZach`"
    ) > -1
  );
  t.true(
    error.cause.message.startsWith(
      "Error with Nunjucks shortcode `postfixWithZach`"
    )
  );
  t.true(
    error.cause.originalError.message.startsWith(
      "Nunjucks sync function Shortcode (error throwing)"
    )
  );
});

test("Nunjucks Async function Shortcode (error throwing)", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode(
    "postfixWithZachError",
    async function (str) {
      throw new Error("Nunjucks Async function Shortcode (error throwing)");
    },
    true
  );

  let error = await t.throwsAsync(async () => {
    await tr._testRender("{% postfixWithZachError name %}", { name: "test" });
  });
  t.true(
    error.message.indexOf(
      "BuildAwesomeNunjucksError: Error with Nunjucks shortcode `postfixWithZachError`"
    ) > -1
  );
  t.true(
    error.cause.message.startsWith(
      "Error with Nunjucks shortcode `postfixWithZachError`"
    )
  );
  t.true(
    error.cause.originalError.message.startsWith(
      "Nunjucks Async function Shortcode (error throwing)"
    )
  );
});

test("Nunjucks sync function paired Shortcode (error throwing)", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode(
    "postfixWithZachError",
    function (str) {
      throw new Error(
        "Nunjucks sync function paired Shortcode (error throwing)"
      );
    },
    false
  );

  let error = await t.throwsAsync(async () => {
    await tr._testRender("{% postfixWithZachError name %}hi{% endpostfixWithZachError %}", {
      name: "test",
    });
  });

  t.true(
    error.message.indexOf(
      "BuildAwesomeNunjucksError: Error with Nunjucks paired shortcode `postfixWithZachError`"
    ) > -1
  );
  t.true(
    error.cause.message.startsWith(
      "Error with Nunjucks paired shortcode `postfixWithZachError`"
    )
  );
  t.true(
    error.cause.originalError.message.startsWith(
      "Nunjucks sync function paired Shortcode (error throwing)"
    )
  );
});

test("Nunjucks Async function paired Shortcode (error throwing)", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode(
    "postfixWithZachError",
    async function (str) {
      throw new Error(
        "Nunjucks Async function paired Shortcode (error throwing)"
      );
    },
    true
  );

  let error = await t.throwsAsync(async () => {
    await tr._testRender("{% postfixWithZachError name %}hi{% endpostfixWithZachError %}", {
      name: "test",
    });
  });

  t.true(
    error.message.indexOf(
      "BuildAwesomeNunjucksError: Error with Nunjucks paired shortcode `postfixWithZachError`"
    ) > -1
  );
  t.true(
    error.cause.message.startsWith(
      "Error with Nunjucks paired shortcode `postfixWithZachError`"
    )
  );
  t.true(
    error.cause.originalError.message.startsWith(
      "Nunjucks Async function paired Shortcode (error throwing)"
    )
  );
});

test("Nunjucks Shortcode Safe Output", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function (str) {
    // Data in context
    t.is(this.page.url, "/hi/");

    return `<span>${str}</span>`;
  });

  t.is(
    await tr._testRender("{% postfixWithZach name %}", {
      name: "test",
      page: {
        url: "/hi/",
      },
    }),
    "<span>test</span>"
  );
});

test("Nunjucks Shortcode return non-string value", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("getYear", function () {
    return 2022;
  });

  t.is(await tr._testRender("{% getYear %}"), "2022");
});

test("Nunjucks Paired Shortcode", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode("postfixWithZach", function (content, str) {
    // Data in context
    t.is(this.page.url, "/hi/");

    return str + content + "Zach";
  });

  t.is(
    await tr._testRender("{% postfixWithZach name %}Content{% endpostfixWithZach %}", {
      name: "test",
      page: {
        url: "/hi/",
      },
    }),
    "testContentZach"
  );
});

test("Nunjucks Async Paired Shortcode", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode(
    "postfixWithZach",
    function (content, str) {
      // Data in context
      t.is(this.page.url, "/hi/");

      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(str + content + "Zach");
        });
      });
    },
    true
  );

  t.is(
    await tr._testRender("{% postfixWithZach name %}Content{% endpostfixWithZach %}", {
      name: "test",
      page: {
        url: "/hi/",
      },
    }),
    "testContentZach"
  );
});

test("Nunjucks Nested Async Paired Shortcode", async (t) => {
  t.plan(3);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode(
    "postfixWithZach",
    function (content, str) {
      // Data in context
      t.is(this.page.url, "/hi/");

      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(str + content + "Zach");
        });
      });
    },
    true
  );

  t.is(
    await tr._testRender(
      "{% postfixWithZach name %}Content{% postfixWithZach name2 %}Content{% endpostfixWithZach %}{% endpostfixWithZach %}",
      {
        name: "test",
        name2: "test2",
        page: {
          url: "/hi/",
        },
      }
    ),
    "testContenttest2ContentZachZach"
  );
});

test("Nunjucks Paired Shortcode without args #372", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode("postfixWithZach", function (content, arg1) {
    // Data in context
    t.is(this.page.url, "/hi/");

    return content + arg1 + "Zach";
  });

  t.is(
    await tr._testRender("{% postfixWithZach %}Content{% endpostfixWithZach %}", {
      name: "test",
      page: {
        url: "/hi/",
      },
    }),
    "ContentundefinedZach"
  );
});

test("Nunjucks Paired Shortcode with Tag Inside", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode("postfixWithZach", function (content, str) {
    // Data in context
    t.is(this.page.url, "/hi/");

    return str + content + "Zach";
  });

  t.is(
    await tr._testRender(
      "{% postfixWithZach name %}Content{% if tester %}If{% endif %}{% endpostfixWithZach %}",
      {
        name: "test",
        tester: true,
        page: {
          url: "/hi/",
        },
      }
    ),
    "testContentIfZach"
  );
});

test("Nunjucks Nested Paired Shortcode", async (t) => {
  t.plan(3);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode("postfixWithZach", function (content, str) {
    // Data in context
    t.is(this.page.url, "/hi/");

    return str + content + "Zach";
  });

  t.is(
    await tr._testRender(
      "{% postfixWithZach name %}Content{% postfixWithZach name2 %}Content{% endpostfixWithZach %}{% endpostfixWithZach %}",
      {
        name: "test",
        name2: "test2",
        page: {
          url: "/hi/",
        },
      }
    ),
    "testContenttest2ContentZachZach"
  );
});

test("Nunjucks Shortcode Multiple Args", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function (str, str2) {
    // Data in context
    t.is(this.page.url, "/hi/");

    return str + str2 + "Zach";
  });

  t.is(
    await tr._testRender("{% postfixWithZach name, other %}", {
      name: "test",
      other: "howdy",
      page: {
        url: "/hi/",
      },
    }),
    "testhowdyZach"
  );
});

test("Nunjucks Shortcode Multiple Args (Comma is required)", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function (str, str2) {
    return str + str2 + "Zach";
  });

  await t.throwsAsync(async () => {
    await tr._testRender("{% postfixWithZach name other %}", {
      name: "test",
      other: "howdy",
    });
  });
});

test("Nunjucks Shortcode Named Args", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function (arg) {
    // Data in context
    t.is(this.page.url, "/hi/");

    return arg.arg1 + arg.arg2 + "Zach";
  });

  t.is(
    await tr._testRender("{% postfixWithZach arg1=name, arg2=other %}", {
      name: "test",
      other: "howdy",
      page: {
        url: "/hi/",
      },
    }),
    "testhowdyZach"
  );
});

test("Nunjucks Shortcode Named Args (Reverse Order)", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function (arg) {
    // Data in context
    t.is(this.page.url, "/hi/");

    return arg.arg1 + arg.arg2 + "Zach";
  });

  t.is(
    await tr._testRender("{% postfixWithZach arg2=other, arg1=name %}", {
      name: "test",
      other: "howdy",
      page: {
        url: "/hi/",
      },
    }),
    "testhowdyZach"
  );
});

test("Nunjucks Shortcode Named Args (JS notation)", async (t) => {
  t.plan(2);

  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function (arg) {
    // Data in context
    t.is(this.page.url, "/hi/");

    return arg.arg1 + arg.arg2 + "Zach";
  });

  t.is(
    await tr._testRender("{% postfixWithZach { arg1: name, arg2: other } %}", {
      name: "test",
      other: "howdy",
      page: {
        url: "/hi/",
      },
    }),
    "testhowdyZach"
  );
});

test("Nunjucks Test if statements on arrays (Issue #524)", async (t) => {
  let tr = await getNewTemplateRender("njk", "./test/stubs/");

  t.is(
    await tr._testRender("{% if 'first' in tags %}Success.{% endif %}", {
      tags: ["first", "second"],
    }),
    "Success."
  );

  t.is(
    await tr._testRender("{% if 'sdfsdfs' in tags %}{% else %}Success.{% endif %}", {
      tags: ["first", "second"],
    }),
    "Success."
  );

  t.is(
    await tr._testRender("{% if false %}{% elseif 'first' in tags %}Success.{% endif %}", {
      tags: ["first", "second"],
    }),
    "Success."
  );

  t.is(
    await tr._testRender("{% if tags.includes('first') %}Success.{% endif %}", {
      tags: ["first", "second"],
    }),
    "Success."
  );

  t.is(
    await tr._testRender("{% if tags.includes('dsds') %}{% else %}Success.{% endif %}", {
      tags: ["first", "second"],
    }),
    "Success."
  );

  t.is(
    await tr._testRender("{% if false %}{% elseif tags.includes('first') %}Success.{% endif %}", {
      tags: ["first", "second"],
    }),
    "Success."
  );
});

test("Issue 611: Run a function", async (t) => {
  // This does not work in Liquid
  let tr = await getNewTemplateRender("njk", "./test/stubs/");

  t.is(
    await tr._testRender("{{ test() }}", {
      test: function () {
        return "alkdsjfksljaZach";
      },
    }),
    "alkdsjfksljaZach"
  );
});

test("Nunjucks bypass compilation", async (t) => {
  let tr = await getNewTemplateRender("njk");

  t.is(tr.engine.needsCompilation("<p>{{ me }}</p>"), true);
  t.is(tr.engine.needsCompilation("<p>{% tag %}{% endtag %}</p>"), true);
  t.is(tr.engine.needsCompilation("<p>test</p>"), false);
});

test("Nunjucks Parse for Symbols", async (t) => {
  let tr = await getNewTemplateRender("njk");
  let engine = tr.engine;

  t.deepEqual(engine.parseForSymbols("<p>{{ name }}</p>"), ["name"]);
  t.deepEqual(engine.parseForSymbols("<p>{{ eleventy.deep.nested }}</p>"), [
    "eleventy.deep.nested",
  ]);
  t.deepEqual(engine.parseForSymbols("<p>{{ a }} {{ b }}</p>"), ["a", "b"]);
  t.deepEqual(engine.parseForSymbols("<p>{% if true %}{{ c }}{% endif %}</p>"), ["c"]);
  t.deepEqual(engine.parseForSymbols("<p>{% if false %}{{ c }}{% endif %}</p>"), ["c"]);
  t.deepEqual(engine.parseForSymbols("{{ collections.all[0] }}>"), [
    // Note that the Liquid parser returns collections.all[0]
    "collections.all",
  ]);
  t.deepEqual(engine.parseForSymbols("{{ collections.mine }}>"), ["collections.mine"]);

  t.deepEqual(engine.parseForSymbols("{{ collections.mine | test }}>"), [
    // TODO not ideal to have `test` in here?
    "test",
    "collections.mine",
  ]);
});

test("Nunjucks Parse for Symbols with custom block", async (t) => {
  let tr = await getNewTemplateRender("njk");
  let engine = tr.engine;
  engine.config.nunjucksShortcodes.test = function () {};

  t.deepEqual(engine.parseForSymbols("<p>{{ name }} {% test %}</p>"), ["name"]);
});

test("Use addNunjucksGlobal with function", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addNunjucksGlobal("fortytwo", function () {
        return 42;
      });
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);

  let fn = await tr.getCompiledTemplate("<p>{{ fortytwo() }}</p>");
  t.is(await fn(), "<p>42</p>");
});

test("Use addNunjucksGlobal with literal", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addNunjucksGlobal("fortytwo", 42);
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);

  let fn = await tr.getCompiledTemplate("<p>{{ fortytwo }}</p>");
  t.is(await fn(), "<p>42</p>");
});

// Async not supported here
test.skip("Use addNunjucksGlobal with async function", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.addNunjucksGlobal("fortytwo", getPromise(42));
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);

  let fn = await tr.getCompiledTemplate("<p>{{ fortytwo() }}</p>");
  t.is(await fn(), "<p>42</p>");
});

test("Use config driven Nunjucks Environment Options (throws on undefined variable)", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.setNunjucksEnvironmentOptions({
        throwOnUndefined: true,
      });
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);

  let fn = await tr.getCompiledTemplate("<p>   {{ test }}</p>");
  await t.throwsAsync(async () => {
    await fn({});
  });
});

test("Use config driven Nunjucks Environment Options (autoescape)", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      cfg.setNunjucksEnvironmentOptions({
        autoescape: false,
      });
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);

  let fn = await tr.getCompiledTemplate("<p>{{ test }}</p>");
  t.is(
    await fn({
      test: "<b>Hi</b>",
    }),
    "<p><b>Hi</b></p>"
  );
});

test("Nunjucks Shortcode in a loop (everything is sync)", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-njk-async/"
    },
    function(cfg) {
      cfg.addNunjucksShortcode("genericshortcode", function (str) {
        return str;
      });
    }
  );

  let tr = await getNewTemplateRender("njk", "./test/stubs-njk-async/", templateConfig);

  let fn = await tr.getCompiledTemplate(
    "{% for item in list %}{% include 'loop.njk' %}{% endfor %}"
  );

  t.is(
    await fn({
      list: ["a", "b", "c"],
    }),
    "included_a-aincluded_b-bincluded_c-c"
  );
});

// TODO!
test.skip("Weird issue with number arguments in a loop (not parsing literals properly?)", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {
      input: "test/stubs-njk-async/"
    },
    function(cfg) {
      cfg.addNunjucksShortcode("genericshortcode", function (str) {
        return str;
      });
    }
  );

  let tr = await getNewTemplateRender("njk", "./test/stubs-njk-async/", templateConfig);
  let fn = await tr.getCompiledTemplate(
    "{% for item in list %}{{item}}-{% genericshortcode item %}{% endfor %}"
  );

  t.is(
    await fn({
      list: [1, 2, 3],
    }),
    "1-12-23-3"
  );
});

test("Make sure addFilter is async-friendly for Nunjucks", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // requires async function
      cfg.addFilter("fortytwo", async function (val, val2) {
        return getPromise(val + val2);
      });
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);

  let fn = await tr.getCompiledTemplate("<p>{{ 10 | fortytwo(2) }}</p>");
  t.is(await fn(), "<p>12</p>");
});

test("Throw an error when you return a promise in addFilter for Nunjucks", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // requires async function
      cfg.addFilter("fortytwo", function () {
        return getPromise(42);
      });
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);
  let fn = await tr.getCompiledTemplate("<p>{{ 'hi' | fortytwo }}</p>");
  await t.throwsAsync(fn);
});

test("addAsyncFilter for Nunjucks", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // works without async function (can return promise)
      cfg.addAsyncFilter("fortytwo", function (val, val2) {
        return getPromise(val + val2);
      });
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);

  let fn = await tr.getCompiledTemplate("<p>{{ 10 | fortytwo(2) }}</p>");
  t.is(await fn(), "<p>12</p>");
});

test("Asynchronous filters (via addNunjucksFilter) for Nunjucks", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // works without async function (can return promise)
      cfg.addNunjucksFilter(
        "fortytwo",
        function (value1, value2, callback) {
          setTimeout(function () {
            callback(null, value1 + value2);
          }, 100);
        },
        true
      );
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);

  let fn = await tr.getCompiledTemplate("<p>{{ 10 | fortytwo(2) }}</p>");
  t.is(await fn(), "<p>12</p>");
});

test("Asynchronous filters (via addNunjucksAsyncFilter) for Nunjucks", async (t) => {
  let templateConfig = await getTemplateConfigInstanceCustomCallback(
    {},
    function(cfg) {
      // works without async function (can return promise)
      cfg.addNunjucksAsyncFilter("fortytwo", function (value1, value2, callback) {
        setTimeout(function () {
          callback(null, value1 + value2);
        }, 100);
      });
    }
  );

  let tr = await getNewTemplateRender("njk", null, templateConfig);

  let fn = await tr.getCompiledTemplate("<p>{{ 10 | fortytwo(2) }}</p>");
  t.is(await fn(), "<p>12</p>");
});

test("Nunjucks Shortcode with this.env #3175", async (t) => {
  t.plan(2);
  let tr = await getNewTemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function () {
    t.truthy(this.env);
    return "Zach";
  });

  t.is(await tr._testRender("{% postfixWithZach %}", {}), "Zach");
});
