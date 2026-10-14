import test from "ava";
import { marked } from "marked";

import TemplateData from "../src/Data/TemplateData.js";
import ExtensionMap from "../src/ExtensionMap.js";

import getNewTemplate from "./_getNewTemplateForTests.js";
import { renderTemplate } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

test("Using getData: false without getInstanceFromInputPath works ok", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
      },
      getData: false,
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  })

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "Sample content");
});

test("Using getData: true without getInstanceFromInputPath should error", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
      },
      getData: true,
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  })

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  await t.throwsAsync(async () => {
    await tmpl.getData();
  }, {
    message: "`getInstanceFromInputPath` callback missing from \'txt\' template engine plugin. It is required when `getData` is in use. You can set `getData: false` to opt-out of this."
  });
});

test("Using getData: [] without getInstanceFromInputPath should error", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
      },
      getData: [],
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  await t.throwsAsync(async () => {
    await tmpl.getData();
  }, {
    message: "`getInstanceFromInputPath` callback missing from \'txt\' template engine plugin. It is required when `getData` is in use. You can set `getData: false` to opt-out of this."
  });
});

test("Using getData: true and getInstanceFromInputPath to get data from instance", async (t) => {
  let globalData = {
    topLevelData: true,
  };

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
      },
      getData: true,
      getInstanceFromInputPath: function () {
        return {
          data: globalData,
        };
      },
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(data.topLevelData, true);
});

test("Using eleventyDataKey to get a different key data from instance", async (t) => {
  let globalData = {
    topLevelData: true,
  };

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "txt",
      key: "txt",
      compileOptions: {
        cache: false,
      },
      getData: [],
      getInstanceFromInputPath: function () {
        return {
          eleventyDataKey: ["otherProp"],
          otherProp: globalData,
        };
      },
      compile: function (str, inputPath) {
        // plaintext
        return function (data) {
          return str;
        };
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(data.topLevelData, true);
});

test("Uses default renderer (no compile function) when you override an existing extension", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
    cfg.extensionMap.add({
      extension: "liquid",
      key: "liquid",
      compileOptions: {
        cache: false,
      },
    });
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/default.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "hi");
});

test("Access to default renderer when you override an existing extension", async (t) => {
  t.plan(2);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.extensionMap.add({
			extension: "liquid",
			key: "liquid",
			compileOptions: {
				cache: false,
			},
			compile: function (str, inputPath) {
				// plaintext
				return function (data) {
					t.true(true);
					return this.defaultRenderer();
				};
			},
		});
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/default.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "hi");
});

test("Overridden liquid gets used from a markdown template", async (t) => {
  t.plan(2);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.extensionMap.add({
			extension: "liquid",
			key: "liquid",
			compileOptions: {
				cache: false,
			},
			compile: function (str, inputPath) {
				t.true(true);

				// plaintext
				return function (data) {
					return this.defaultRenderer();
				};
			},
		});
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/default.md",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is((await renderTemplate(tmpl, data)).trim(), "<p>hi</p>");
});

test("Use marked for markdown", async (t) => {
  t.plan(2);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.extensionMap.add({
			extension: "md",
			key: "md",
			compileOptions: {
				cache: false,
			},
			compile: function (str, inputPath) {
				let html = marked.parse(str);
				// plaintext
				return function (data) {
					t.true(true);
					return html;
				};
			},
		});
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/default-no-liquid.md",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is((await renderTemplate(tmpl, data)).trim(), "<p>hi</p>");
});

test("Use defaultRenderer for markdown", async (t) => {
  t.plan(2);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.extensionMap.add({
			extension: "md",
			key: "md",
			compileOptions: {
				cache: false,
			},
			compile: function (str, inputPath) {
				return function (data) {
					t.true(true);
					return this.defaultRenderer(data);
				};
			},
		});
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/default.md",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is((await renderTemplate(tmpl, data)).trim(), "<p>hi</p>");
});

test("Front matter in a custom extension", async (t) => {
  t.plan(2);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.extensionMap.add({
			extension: "txt",
			key: "txt",
			compileOptions: {
				cache: false,
			},
			compile: function (str, inputPath) {
				return function (data) {
					return str;
				};
			},
		});
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/default-frontmatter.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(data.frontmatter, 1);
  t.is((await renderTemplate(tmpl, data)).trim(), "hi");
});

test("Access to default renderer when you override an existing extension (async compile function, arrow render function)", async (t) => {
  t.plan(2);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.extensionMap.add({
			extension: "liquid",
			key: "liquid",
			compileOptions: {
				cache: false,
			},
			compile: async function (str, inputPath) {
				// plaintext
				return async (data) => {
					t.true(true);
					return this.defaultRenderer();
				};
			},
		});
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/default.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "hi");
});

test("Access to default renderer when you override an existing extension (async compile function, async render function)", async (t) => {
  t.plan(2);

  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.extensionMap.add({
			extension: "liquid",
			key: "liquid",
			compileOptions: {
				cache: false,
			},
			compile: async function (str, inputPath) {
				// plaintext
				return async function (data) {
					t.true(true);
					return this.defaultRenderer();
				};
			},
		});
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/default.liquid",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), "hi");
});

test("Return undefined in compile to ignore #2267", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.extensionMap.add({
			extension: "txt",
			key: "txt",
			compileOptions: {
				cache: false,
			},
			getData: false,
			compile: function (str, inputPath) {
				return;
			},
		});
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), undefined);
});

test("Return undefined in compile to ignore (async compile function) #2350", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs"
  }, function(cfg) {
		cfg.extensionMap.add({
			extension: "txt",
			key: "txt",
			compileOptions: {
				cache: false,
			},
			getData: false,
			compile: async function (str, inputPath) {
				return;
			},
		});
  });

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.extensionMap = new ExtensionMap(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/custom-extension.txt",
    "./test/stubs/",
    "dist",
    dataObj,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.is(await renderTemplate(tmpl, data), undefined);
});
