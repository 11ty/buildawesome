import test from "node:test";
import semver from "semver";

import getNewTemplate from "./_getNewTemplateForTests.js";
import { getRenderedTemplates as getRenderedTmpls } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

async function getVirtualTemplate(name, content) {
  let $config = await getTemplateConfigInstanceCustomCallback({ input: "test/stubs", output: "dist" }, (cfg) => {
    cfg.addTemplate(name, content);
  });
  return getNewTemplate(`./test/stubs/${name}`, "./test/stubs/", "./dist", null, null, $config);
}

test("JavaScript template type (function)", async (t) => {
  let tmpl = await getVirtualTemplate("function.11ty.cjs", function (data) {
    return `<p>${data.name}</p>`;
  });

  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/function/index.html");
  data.name = "Zach";

  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>Zach</p>");

  // New in 2.0.0-canary.19 Issue #1522
  t.assert.strictEqual(pages[0].content.trim(), "<p>Zach</p>");
  t.assert.strictEqual(pages[0].page.url, "/function/");
});

test("JavaScript template type (class with data getter)", async (t) => {
  let tmpl = await getVirtualTemplate("class-data.11ty.cjs", class {
    get data() {
      return {
        name: "Ted",
      };
    }

    render({ name }) {
      return `<p>${name}</p>`;
    }
  });

  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/class-data/index.html");

  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>Ted</p>");
  t.assert.strictEqual(pages[0].content.trim(), "<p>Ted</p>");
});

test("JavaScript template type (class with data method)", async (t) => {
  let tmpl = await getVirtualTemplate("class-data-fn.11ty.cjs", class {
    data() {
      return {
        name: "Ted",
      };
    }

    render({ name }) {
      return `<p>${name}</p>`;
    }
  });

  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/class-data-fn/index.html");

  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>Ted</p>");
  t.assert.strictEqual(pages[0].content.trim(), "<p>Ted</p>");
});

if (semver.gte(process.version, "12.4.0")) {
  test("JavaScript template type (class fields)", async (t) => {
    let tmpl = await getVirtualTemplate("classfields-data.11ty.cjs", class {
      data = {
        name: "Ted",
      };

      render({ name }) {
        return `<p>${name}</p>`;
      }
    });

    let data = await tmpl.getData();
    t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/classfields-data/index.html");

    let pages = await getRenderedTmpls(tmpl, data);
    t.assert.strictEqual(pages[0].templateContent.trim(), "<p>Ted</p>");
    t.assert.strictEqual(pages[0].content.trim(), "<p>Ted</p>");
  });
}

test("JavaScript template type (class with shorthand data method)", async (t) => {
  function Test() {}
  Test.prototype.data = () => {
    return { name: "Ted" };
  };
  Test.prototype.render = ({ name }) => `<p>${name}</p>`;

  let tmpl = await getVirtualTemplate("class-data-fn-shorthand.11ty.cjs", Test);

  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/class-data-fn-shorthand/index.html");

  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>Ted</p>");
  t.assert.strictEqual(pages[0].content.trim(), "<p>Ted</p>");
});

test("JavaScript template type (class with async data method)", async (t) => {
  let tmpl = await getVirtualTemplate("class-async-data-fn.11ty.cjs", class {
    async data() {
      return new Promise((resolve) => {
        setTimeout(function () {
          resolve({
            name: "Ted",
          });
        }, 50);
      });
    }

    render({ name }) {
      return `<p>${name}</p>`;
    }
  });

  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/class-async-data-fn/index.html");

  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>Ted</p>");
  t.assert.strictEqual(pages[0].content.trim(), "<p>Ted</p>");
});

test("JavaScript template type (class with data getter and a javascriptFunction)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist",
  }, function(cfg) {
    cfg.addTemplate("class-data-filter.11ty.cjs", class {
      get data() {
        return {
          name: "Ted",
        };
      }

      render({ name }) {
        return `<p>${this.upper(name)}</p>`;
      }
    });
    cfg.addJavaScriptFunction("upper", function (val) {
      return new String(val).toUpperCase();
    });
  });

  let tmpl = await getNewTemplate(
    "./test/stubs/class-data-filter.11ty.cjs",
    "./test/stubs/",
    "./dist",
    null,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/class-data-filter/index.html");
  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].content.trim(), "<p>TED</p>");
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>TED</p>");
});

test("JavaScript template type (class with data method and a javascriptFunction)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    output: "dist",
  }, function(cfg) {
    cfg.addTemplate("class-data-fn-filter.11ty.cjs", class {
      data() {
        return {
          name: "Ted",
        };
      }

      render({ name }) {
        return `<p>${this.upper(name)}</p>`;
      }
    });
    cfg.addJavaScriptFunction("upper", function (val) {
      return new String(val).toUpperCase();
    });
  });

  let tmpl = await getNewTemplate(
    "./test/stubs/class-data-fn-filter.11ty.cjs",
    "./test/stubs/",
    "./dist",
    null,
    null,
    eleventyConfig
  );

  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/class-data-fn-filter/index.html");
  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].content.trim(), "<p>TED</p>");
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>TED</p>");
});

test("JavaScript template type (class with data permalink)", async (t) => {
  let tmpl = await getVirtualTemplate("class-data-permalink.11ty.cjs", class {
    get data() {
      return {
        permalink: "/my-permalink/",
      };
    }

    render({ name }) {
      return `<p>${name}</p>`;
    }
  });
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/my-permalink/index.html");
});

test("JavaScript template type (class with data permalink using a buffer)", async (t) => {
  let tmpl = await getVirtualTemplate("class-data-permalink-buffer.11ty.cjs", class {
    get data() {
      return {
        permalink: Buffer.from("/my-permalink/"),
      };
    }

    render({ name }) {
      return `<p>${name}</p>`;
    }
  });
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/my-permalink/index.html");
});

test("JavaScript template type (class with data permalink function)", async (t) => {
  let tmpl = await getVirtualTemplate("class-data-permalink-fn.11ty.cjs", class {
    get data() {
      return {
        key: "value1",
        permalink: (data) => `/my-permalink/${data.key}/`,
      };
    }

    render({ name }) {
      return `<p>${name}</p>`;
    }
  });
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/my-permalink/value1/index.html");
});

test("JavaScript template type (class with data permalink function using a buffer)", async (t) => {
  let tmpl = await getVirtualTemplate("class-data-permalink-fn-buffer.11ty.cjs", class {
    get data() {
      return {
        key: "value1",
        permalink: (data) => Buffer.from(`/my-permalink/${data.key}/`),
      };
    }

    render({ name }) {
      return `<p>${name}</p>`;
    }
  });
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/my-permalink/value1/index.html");
});

test("JavaScript template type (class with data permalink async function)", async (t) => {
  let tmpl = await getVirtualTemplate("class-data-permalink-async-fn.11ty.cjs", class {
    get data() {
      return {
        key: "value1",
        permalink: async function (data) {
          return new Promise((resolve) => {
            setTimeout(function () {
              resolve(`/my-permalink/${data.key}/`);
            }, 100);
          });
        },
      };
    }

    render({ name }) {
      return `<p>${name}</p>`;
    }
  });
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/my-permalink/value1/index.html");
});

test("JavaScript template type (class with data permalink function using a filter)", async (t) => {
  let tmpl = await getVirtualTemplate("class-data-permalink-fn-filter.11ty.cjs", class {
    get data() {
      return {
        title: "My Super Cool Title",
        permalink: function ({ title }) {
          return `/my-permalink/${this.slugify(title)}/`;
        },
      };
    }

    render({ name }) {
      return `<p>${name}</p>`;
    }
  });

  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/my-permalink/my-super-cool-title/index.html");
});

test("JavaScript template type (should use the same class instance for data and render)", async (t) => {
  let tmpl = await getNewTemplate("./test/stubs/oneinstance.11ty.cjs", "./test/stubs/", "./dist");

  let data = await tmpl.getData();
  let pages = await getRenderedTmpls(tmpl, data);
  // the template renders the random number created in the class constructor
  // the data returns the random number created in the class constructor
  // if they are different, the class is not reused.
  t.assert.strictEqual(pages[0].content.trim(), `<p>Ted${data.rand}</p>`);
  t.assert.strictEqual(pages[0].templateContent.trim(), `<p>Ted${data.rand}</p>`);
});

test("JavaScript template type (multiple exports)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/multipleexports.11ty.cjs",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].content.trim(), "<p>Ted</p>");
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>Ted</p>");
});

test("JavaScript template type (multiple exports, promises)", async (t) => {
  let tmpl = await getNewTemplate(
    "./test/stubs/multipleexports-promises.11ty.cjs",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  t.assert.strictEqual(data.name, "Ted");

  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].content.trim(), "<p>Ted</p>");
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>Ted</p>");
});

test("JavaScript template type (object)", async (t) => {
  let tmpl = await getVirtualTemplate("object.11ty.cjs", {
    data: {
      name: "Ted",
    },
    render: function ({ name }) {
      return `<p>${name}</p>`;
    },
  });

  let data = await tmpl.getData();
  t.assert.strictEqual(data.name, "Ted");

  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].content.trim(), "<p>Ted</p>");
  t.assert.strictEqual(pages[0].templateContent.trim(), "<p>Ted</p>");
});

test("JavaScript template type (object, no render method)", async (t) => {
  let tmpl = await getVirtualTemplate("object-norender.11ty.cjs", {
    data: {
      name: "Ted",
    },
  });

  let data = await tmpl.getData();
  t.assert.strictEqual(data.name, "Ted");

  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].templateContent.trim(), "");
  t.assert.strictEqual(pages[0].content.trim(), "");
});

test("JavaScript template type (class, no render method)", async (t) => {
  let tmpl = await getVirtualTemplate("class-norender.11ty.cjs", class {
    data() {
      return {
        name: "Ted",
      };
    }
  });

  let data = await tmpl.getData();
  t.assert.strictEqual(data.name, "Ted");

  let pages = await getRenderedTmpls(tmpl, data);
  t.assert.strictEqual(pages[0].templateContent.trim(), "");
  t.assert.strictEqual(pages[0].content.trim(), "");
});
test("JavaScript template type (data returns a string)", async (t) => {
  let tmpl = await getVirtualTemplate("exports-flatdata.11ty.cjs", {
    data: "Ted",
    render: function (name) {
      return `<p>${JSON.stringify(name)}</p>`;
    },
  });

  await t.assert.rejects(async () => {
    await tmpl.getData();
  });
});
