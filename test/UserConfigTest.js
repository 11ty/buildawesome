import test from "ava";
import UserConfig from "../src/UserConfig.js";
import memoize from "../src/Util/MemoizeFunction.js";

test("Template Formats", (t) => {
  let userCfg = new UserConfig();

  t.falsy(userCfg.templateFormats);

  userCfg.setTemplateFormats("njk,liquid");
  t.deepEqual(userCfg.templateFormats, "njk,liquid");

  // setting multiple times takes the last one
  userCfg.setTemplateFormats("njk,liquid,pug");
  userCfg.setTemplateFormats("njk,liquid");
  t.deepEqual(userCfg.templateFormats, "njk,liquid");
});

test("Template Formats (Arrays)", (t) => {
  let userCfg = new UserConfig();

  t.falsy(userCfg.templateFormats);

  userCfg.setTemplateFormats(["njk", "liquid"]);
  t.deepEqual(userCfg.templateFormats, ["njk", "liquid"]);

  // setting multiple times takes the last one
  userCfg.setTemplateFormats(["njk", "liquid", "pug"]);
  userCfg.setTemplateFormats(["njk", "liquid"]);
  t.deepEqual(userCfg.templateFormats, ["njk", "liquid"]);
});

// more in TemplateConfigTest.js

test("Events", async (t) => {
  await new Promise((resolve) => {
    let userCfg = new UserConfig();
    userCfg.on("testEvent", function (arg1, arg2, arg3) {
      t.is(arg1, "arg1");
      t.is(arg2, "arg2");
      t.is(arg3, "arg3");
      resolve();
    });

    userCfg.emit("testEvent", "arg1", "arg2", "arg3");
  });
});

test("Async Events", async (t) => {
  await new Promise((resolve) => {
    let userCfg = new UserConfig();
    let arg1;

    userCfg.on(
      "asyncTestEvent",
      (_arg1) =>
        new Promise((resolve) => {
          setTimeout(() => {
            arg1 = _arg1;
            resolve();
          }, 10);
        })
    );

    userCfg.emit("asyncTestEvent", "arg1").then(() => {
      t.is(arg1, "arg1");
      resolve();
    });
  });
});

test("Add Collections", (t) => {
  let userCfg = new UserConfig();
  userCfg.addCollection("myCollection", function (collection) {});
  t.deepEqual(Object.keys(userCfg.getCollections()), ["myCollection"]);
});

test("Add Collections throws error on key collision", (t) => {
  let userCfg = new UserConfig();
  userCfg.addCollection("myCollectionCollision", function (collection) {});

  t.throws(() => {
    userCfg.addCollection("myCollectionCollision", function (collection) {});
  });
});

test("Set manual Pass-through File Copy (single call)", (t) => {
  let userCfg = new UserConfig();
  userCfg.addPassthroughCopy("img");

  t.deepEqual(userCfg.passthroughCopies["img"], {
    outputPath: true,
    copyOptions: {},
  });
});

test("Set manual Pass-through File Copy (chained calls)", (t) => {
  let userCfg = new UserConfig();
  userCfg
    .addPassthroughCopy("css")
    .addPassthroughCopy("js")
    .addPassthroughCopy({ "./src/static": "static" })
    .addPassthroughCopy({ "./src/empty": "./" });

  t.deepEqual(userCfg.passthroughCopies["css"], {
    outputPath: true,
    copyOptions: {},
  });
  t.deepEqual(userCfg.passthroughCopies["js"], {
    outputPath: true,
    copyOptions: {},
  });
  t.deepEqual(userCfg.passthroughCopies["./src/static"], {
    outputPath: "static",
    copyOptions: {},
  });
  t.deepEqual(userCfg.passthroughCopies["./src/empty"], {
    outputPath: "./",
    copyOptions: {},
  });
});

test("Set manual Pass-through File Copy (glob patterns)", (t) => {
  let userCfg = new UserConfig();
  userCfg.addPassthroughCopy({
    "./src/static/**/*": "renamed",
    "./src/markdown/*.md": "",
  });

  // does not exist
  t.is(userCfg.passthroughCopies["css/**"], undefined);
  t.is(userCfg.passthroughCopies["js/**"], undefined);

  // exists
  t.deepEqual(userCfg.passthroughCopies["./src/static/**/*"], {
    outputPath: "renamed",
    copyOptions: {},
  });
  t.deepEqual(userCfg.passthroughCopies["./src/markdown/*.md"], {
    outputPath: "",
    copyOptions: {},
  });
});

test("Set Template Formats (string)", (t) => {
  let userCfg = new UserConfig();
  userCfg.setTemplateFormats("njk, liquid");
  t.deepEqual(userCfg.templateFormats, "njk, liquid");
});

test("Set Template Formats (array)", (t) => {
  let userCfg = new UserConfig();
  userCfg.setTemplateFormats(["njk", "liquid"]);
  t.deepEqual(userCfg.templateFormats, ["njk", "liquid"]);
});

test("Set Template Formats (js passthrough copy)", (t) => {
  let userCfg = new UserConfig();
  userCfg.setTemplateFormats("njk, liquid, js");
  t.deepEqual(userCfg.templateFormats, "njk, liquid, js");
});

test("Set Template Formats (11ty.js)", (t) => {
  let userCfg = new UserConfig();
  userCfg.setTemplateFormats("njk, liquid, 11ty.js");
  t.deepEqual(userCfg.templateFormats, "njk, liquid, 11ty.js");
});

test("Add Template Formats", (t) => {
  let userCfg = new UserConfig();
  userCfg.addTemplateFormats("njk");
  userCfg.addTemplateFormats("webc");
  userCfg.addTemplateFormats("liquid");
  userCfg.addTemplateFormats("11ty.js");

  t.deepEqual(userCfg.templateFormatsAdded.sort(), ["11ty.js", "liquid", "njk", "webc"]);
});

test("Resolve plugin", async (t) => {
  let userConfig = new UserConfig();
  let plugin = await userConfig.resolvePlugin("@11ty/eleventy/html-base-plugin");
  t.truthy(typeof plugin === "function")
});

test("Resolve plugin (invalid)", async (t) => {
  let userConfig = new UserConfig();
  let e = await t.throwsAsync(async() => {
    await userConfig.resolvePlugin("@11ty/eleventy/does-not-exist");
  });
  t.truthy(e.message.startsWith(`Invalid name "@11ty/eleventy/does-not-exist" passed to resolvePlugin.`));
});

test("Memoize filters (control)", (t) => {
  let userCfg = new UserConfig();
  let count = 0;
  userCfg.addFilter("increment", (num) => {
    count += num;
  });

  let increment = userCfg.getFilter("increment");
  increment(3);

  t.is(count, 3);

  increment(3);
  t.is(count, 6);
});

test("Memoize filters (memoized)", (t) => {
  let userCfg = new UserConfig();
  let count = 0;
  userCfg.addFilter("increment", memoize((num) => {
    count += num;
  }));

  let increment = userCfg.getFilter("increment");

  increment(1);
  increment(1);
  increment(1);
  t.is(count, 1);

  increment(2);
  increment(2);
  increment(2);
  t.is(count, 3);

  increment(3);
  increment(3);
  increment(3);
  increment(3);
  t.is(count, 6);
});

test("Memoize async filters (memoized)", async (t) => {
  let userCfg = new UserConfig();
  let count = 0;

  userCfg.addFilter("increment", memoize(async (num) => {
    return new Promise(resolve => {
      setTimeout(() => {
        count += num;
        resolve(count);
      }, 50);
    });
  }));

  let increment = userCfg.getFilter("increment");
  await increment(1);
  await increment(1);
  await increment(1);
  t.is(count, 1);

  await increment(2);
  await increment(2);
  await increment(2);
  t.is(count, 3);

  await increment(3);
  await increment(3);
  await increment(3);
  await increment(3);
  t.is(count, 6);
});

// JavaScript functions are included here for backwards compatibility https://github.com/11ty/eleventy/issues/3365
test("addJavaScriptFunction feeds into `getFilter` #3365", (t) => {
  let userCfg = new UserConfig();
  userCfg.addJavaScriptFunction("increment", num => num++);

  t.is(typeof userCfg.getFilter("increment"), "function");
});
