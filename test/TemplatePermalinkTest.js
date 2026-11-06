import test from "node:test";
import TemplatePermalink from "../src/TemplatePermalink.js";

const { generate } = TemplatePermalink;

test("Simple straight permalink", (t) => {
  t.assert.strictEqual(
    new TemplatePermalink("permalinksubfolder/test.html").toOutputPath(),
    "permalinksubfolder/test.html"
  );
  t.assert.strictEqual(
    new TemplatePermalink("./permalinksubfolder/test.html").toOutputPath(),
    "permalinksubfolder/test.html"
  );

  t.assert.strictEqual(
    new TemplatePermalink("permalinksubfolder/test.html").toHref(),
    "/permalinksubfolder/test.html"
  );
  t.assert.strictEqual(
    new TemplatePermalink("./permalinksubfolder/test.html").toHref(),
    "/permalinksubfolder/test.html"
  );
  t.assert.strictEqual(new TemplatePermalink("./testindex.html").toHref(), "/testindex.html");
  t.assert.strictEqual(
    new TemplatePermalink("./permalinksubfolder/testindex.html").toHref(),
    "/permalinksubfolder/testindex.html"
  );
});

test("Permalink without filename", (t) => {
  t.assert.strictEqual(
    new TemplatePermalink("permalinksubfolder/").toOutputPath(),
    "permalinksubfolder/index.html"
  );
  t.assert.strictEqual(
    new TemplatePermalink("./permalinksubfolder/").toOutputPath(),
    "permalinksubfolder/index.html"
  );
  t.assert.strictEqual(
    new TemplatePermalink("/permalinksubfolder/").toOutputPath(),
    "/permalinksubfolder/index.html"
  );

  t.assert.strictEqual(new TemplatePermalink("permalinksubfolder/").toHref(), "/permalinksubfolder/");
  t.assert.strictEqual(new TemplatePermalink("./permalinksubfolder/").toHref(), "/permalinksubfolder/");
  t.assert.strictEqual(new TemplatePermalink("/permalinksubfolder/").toHref(), "/permalinksubfolder/");
});

test("Permalink with pagination subdir", (t) => {
  t.assert.strictEqual(
    new TemplatePermalink("permalinksubfolder/test.html", "0/").toOutputPath(),
    "permalinksubfolder/0/test.html"
  );
  t.assert.strictEqual(
    new TemplatePermalink("permalinksubfolder/test.html", "1/").toOutputPath(),
    "permalinksubfolder/1/test.html"
  );

  t.assert.strictEqual(
    new TemplatePermalink("permalinksubfolder/test.html", "0/").toHref(),
    "/permalinksubfolder/0/test.html"
  );
  t.assert.strictEqual(
    new TemplatePermalink("permalinksubfolder/test.html", "1/").toHref(),
    "/permalinksubfolder/1/test.html"
  );
});

test("Permalink generate", (t) => {
  t.assert.strictEqual(generate("./", "index").toOutputPath(), "index.html");
  t.assert.strictEqual(generate("./", "index").toHref(), "/");
  t.assert.strictEqual(generate(".", "index").toOutputPath(), "index.html");
  t.assert.strictEqual(generate(".", "index").toHref(), "/");
  t.assert.strictEqual(generate(".", "test").toOutputPath(), "test/index.html");
  t.assert.strictEqual(generate(".", "test").toHref(), "/test/");
  t.assert.strictEqual(generate(".", "test", "0/").toOutputPath(), "test/0/index.html");
  t.assert.strictEqual(generate(".", "test", "0/").toHref(), "/test/0/");
  t.assert.strictEqual(generate(".", "test", "1/").toOutputPath(), "test/1/index.html");
  t.assert.strictEqual(generate(".", "test", "1/").toHref(), "/test/1/");
});

test("Permalink generate with suffix", (t) => {
  t.assert.strictEqual(generate(".", "test", null).toOutputPath(), "test/index.html");
  t.assert.strictEqual(generate(".", "test", null).toHref(), "/test/");
  t.assert.strictEqual(generate(".", "test", "1/").toOutputPath(), "test/1/index.html");
  t.assert.strictEqual(generate(".", "test", "1/").toHref(), "/test/1/");
});

test("Permalink generate with new extension", (t) => {
  t.assert.strictEqual(generate(".", "test", null, "css").toOutputPath(), "test.css");
  t.assert.strictEqual(generate(".", "test", null, "css").toHref(), "/test.css");
  t.assert.strictEqual(generate(".", "test", "1/", "css").toOutputPath(), "1/test.css");
  t.assert.strictEqual(generate(".", "test", "1/", "css").toHref(), "/1/test.css");
});

test("Permalink generate with subfolders", (t) => {
  t.assert.strictEqual(generate("permalinksubfolder/", "index").toOutputPath(), "permalinksubfolder/index.html");
  t.assert.strictEqual(
    generate("permalinksubfolder/", "test").toOutputPath(),
    "permalinksubfolder/test/index.html"
  );
  t.assert.strictEqual(
    generate("permalinksubfolder/", "test", "1/").toOutputPath(),
    "permalinksubfolder/test/1/index.html"
  );

  t.assert.strictEqual(generate("permalinksubfolder/", "index").toHref(), "/permalinksubfolder/");
  t.assert.strictEqual(generate("permalinksubfolder/", "test").toHref(), "/permalinksubfolder/test/");
  t.assert.strictEqual(
    generate("permalinksubfolder/", "test", "1/").toHref(),
    "/permalinksubfolder/test/1/"
  );
});

test("Permalink matching folder and filename", (t) => {
  let hasDupe = TemplatePermalink._hasDuplicateFolder;
  t.assert.strictEqual(hasDupe("subfolder", "component"), false);
  t.assert.strictEqual(hasDupe("subfolder/", "component"), false);
  t.assert.strictEqual(hasDupe(".", "component"), false);

  t.assert.strictEqual(hasDupe("component", "component"), true);
  t.assert.strictEqual(hasDupe("component/", "component"), true);

  t.assert.strictEqual(generate("component/", "component").toOutputPath(), "component/index.html");
  t.assert.strictEqual(generate("component/", "component").toHref(), "/component/");
});

test("Permalink Object, build alias", (t) => {
  t.assert.strictEqual(new TemplatePermalink({ build: "permalinksubfolder/test.html" }).toOutputPath(), "permalinksubfolder/test.html");
  t.assert.strictEqual(new TemplatePermalink({ build: false }).toOutputPath(), false);
  t.assert.throws(() => new TemplatePermalink({ build: true }));
});

test("Permalink Object without build throws", (t) => {
  t.assert.throws(() => new TemplatePermalink({}));
  t.assert.throws(() => new TemplatePermalink({ someotherkey: "/" }));
});

test("Permalink generate apache content negotiation #761", (t) => {
  let tp = new TemplatePermalink("index.es.html");
  tp.setUrlTransforms([
    function ({ url }) {
      return "/";
    },
  ]);

  t.assert.strictEqual(tp.toHref(), "/");
  t.assert.strictEqual(tp.toOutputPath(), "index.es.html");

  // Note that generate does some preprocessing to the raw permalink value (compared to `new TemplatePermalink`)
  let tp1 = TemplatePermalink.generate("", "index.es");
  tp1.setUrlTransforms([
    function ({ url }) {
      return "/";
    },
  ]);
  t.assert.strictEqual(tp1.toHref(), "/");
  // best paired with https://v3.11ty.dev/docs/data-eleventy-supplied/#filepathstem for index.es.html
  t.assert.strictEqual(tp1.toOutputPath(), "index.es/index.html");
});

test("Permalink generate apache content negotiation with subdirectory #761", (t) => {
  let tp = new TemplatePermalink("test/index.es.html");
  tp.setUrlTransforms([
    function ({ url }) {
      return "/test/";
    },
  ]);

  t.assert.strictEqual(tp.toHref(), "/test/");
  t.assert.strictEqual(tp.toOutputPath(), "test/index.es.html");

  // Note that generate does some preprocessing to the raw permalink value (compared to `new TemplatePermalink`)
  let tp1 = TemplatePermalink.generate("test", "index.es");
  tp1.setUrlTransforms([
    function ({ url }) {
      return "/test/";
    },
  ]);

  t.assert.strictEqual(tp1.toHref(), "/test/");
  // best paired with https://v3.11ty.dev/docs/data-eleventy-supplied/#filepathstem for test/index.es.html
  t.assert.strictEqual(tp1.toOutputPath(), "test/index.es/index.html");
});

test("Permalink generate apache content negotiation non-index file name #761", (t) => {
  // Note that generate does some preprocessing to the raw permalink value (compared to `new TemplatePermalink`)
  let tp = TemplatePermalink.generate("permalinksubfolder", "about.es");

  t.assert.strictEqual(tp.toHref(), "/permalinksubfolder/about.es/");
  t.assert.strictEqual(tp.toOutputPath(), "permalinksubfolder/about.es/index.html");
});

test("Permalink generate with urlTransforms #761", (t) => {
  // Note that TemplatePermalink.generate is used by Template and different from new TemplatePermalink
  let tp = TemplatePermalink.generate("permalinksubfolder", "index.es");

  tp.setUrlTransforms([
    function ({ url }) {
      return "/permalinksubfolder/";
    },
  ]);

  t.assert.strictEqual(tp.toHref(), "/permalinksubfolder/");
  // best paired with https://v3.11ty.dev/docs/data-eleventy-supplied/#filepathstem for permalinksubfolder/index.es.html
  t.assert.strictEqual(tp.toOutputPath(), "permalinksubfolder/index.es/index.html");
});

test("Permalink generate with urlTransforms (skip via undefined) #761", (t) => {
  // Note that TemplatePermalink.generate is used by Template and different from new TemplatePermalink
  let tp = TemplatePermalink.generate("permalinksubfolder", "index.es");

  tp.setUrlTransforms([
    function ({ url }) {
      // return nothing
    },
  ]);

  t.assert.strictEqual(tp.toHref(), "/permalinksubfolder/index.es/");
  // best paired with https://v3.11ty.dev/docs/data-eleventy-supplied/#filepathstem for permalinksubfolder/index.es.html
  t.assert.strictEqual(tp.toOutputPath(), "permalinksubfolder/index.es/index.html");
});

test("Permalink generate with 2 urlTransforms #761", (t) => {
  // Note that TemplatePermalink.generate is used by Template and different from new TemplatePermalink
  let tp = TemplatePermalink.generate("permalinksubfolder", "index.es");
  tp.setUrlTransforms([
    function ({ url }) {
      return "/abc/";
    },
    function ({ url }) {
      return "/def/";
    },
  ]);

  t.assert.strictEqual(tp.toHref(), "/def/");
  // best paired with https://v3.11ty.dev/docs/data-eleventy-supplied/#filepathstem for permalinksubfolder/index.es.html
  t.assert.strictEqual(tp.toOutputPath(), "permalinksubfolder/index.es/index.html");
});

test("Permalink generate with urlTransforms returns index.html #761", (t) => {
  // Note that TemplatePermalink.generate is used by Template and different from new TemplatePermalink
  let tp = TemplatePermalink.generate("permalinksubfolder", "index.es");
  tp.setUrlTransforms([
    function ({ url }) {
      return "/abc/index.html";
    },
  ]);

  t.assert.strictEqual(tp.toHref(), "/abc/");
  // best paired with https://v3.11ty.dev/docs/data-eleventy-supplied/#filepathstem for permalinksubfolder/index.es.html
  t.assert.strictEqual(tp.toOutputPath(), "permalinksubfolder/index.es/index.html");
});

test("Permalink generate with urlTransforms code (index file) #761", (t) => {
  let tp1 = new TemplatePermalink("index.es.html");

  tp1.setUrlTransforms([
    function ({ url, urlStem }) {
      t.assert.strictEqual(url, "/index.es.html");
      t.assert.strictEqual(urlStem, "/index.es");

      if (url.match(/\.[a-z]{2}\.html$/i)) {
        // trailing slash
        return url.slice(0, -1 * ".en.html".length) + "/";
      }
    },
  ]);

  t.assert.strictEqual(tp1.toHref(), "/");

  let tp2 = new TemplatePermalink("index.es.html");

  tp2.setUrlTransforms([
    function ({ url, urlStem }) {
      t.assert.strictEqual(url, "/index.es.html");
      t.assert.strictEqual(urlStem, "/index.es");

      if (url.match(/\.[a-z]{2}\.html$/i)) {
        // no trailing slash
        return url.slice(0, -1 * ".en.html".length);
      }
    },
  ]);

  t.assert.strictEqual(tp2.toHref(), "/");
});

test("Permalink generate with urlTransforms code (not index file) #761", (t) => {
  let tp1 = new TemplatePermalink("about.es.html");

  tp1.setUrlTransforms([
    function ({ url, urlStem }) {
      t.assert.strictEqual(url, "/about.es.html");
      t.assert.strictEqual(urlStem, "/about.es");

      if (url.match(/\.[a-z]{2}\.html$/i)) {
        // trailing slash
        return url.slice(0, -1 * ".en.html".length) + "/";
      }
    },
  ]);

  t.assert.strictEqual(tp1.toHref(), "/about/");

  let tp2 = new TemplatePermalink("about.es.html");

  tp2.setUrlTransforms([
    function ({ url }) {
      if (url.match(/\.[a-z]{2}\.html$/i)) {
        // no trailing slash
        return url.slice(0, -1 * ".en.html".length);
      }
    },
  ]);

  t.assert.strictEqual(tp2.toHref(), "/about");
});

test("Permalink generate with urlTransforms code (index file with subdir) #761", (t) => {
  let tp1 = new TemplatePermalink("subdir/index.es.html");

  tp1.setUrlTransforms([
    function ({ url, urlStem }) {
      t.assert.strictEqual(url, "/subdir/index.es.html");
      t.assert.strictEqual(urlStem, "/subdir/index.es");

      if (url.match(/\.[a-z]{2}\.html$/i)) {
        // trailing slash
        return url.slice(0, -1 * ".en.html".length) + "/";
      }
    },
  ]);

  t.assert.strictEqual(tp1.toHref(), "/subdir/");

  let tp2 = new TemplatePermalink("subdir/index.es.html");

  tp2.setUrlTransforms([
    function ({ url, urlStem }) {
      t.assert.strictEqual(url, "/subdir/index.es.html");
      t.assert.strictEqual(urlStem, "/subdir/index.es");

      if (url.match(/\.[a-z]{2}\.html$/i)) {
        // no trailing slash
        return url.slice(0, -1 * ".en.html".length);
      }
    },
  ]);

  t.assert.strictEqual(tp2.toHref(), "/subdir/");
});

test("Permalink generate with urlTransforms code (not-index file with subdir) #761", (t) => {
  let tp1 = new TemplatePermalink("subdir/about.es.html");

  tp1.setUrlTransforms([
    function ({ url, urlStem }) {
      if (url.match(/\.[a-z]{2}\.html$/i)) {
        t.assert.strictEqual(url, "/subdir/about.es.html");
        t.assert.strictEqual(urlStem, "/subdir/about.es");

        // trailing slash
        return url.slice(0, -1 * ".en.html".length) + "/";
      }
    },
  ]);

  t.assert.strictEqual(tp1.toHref(), "/subdir/about/");

  let tp2 = new TemplatePermalink("subdir/about.es.html");

  tp2.setUrlTransforms([
    function ({ url, urlStem }) {
      t.assert.strictEqual(url, "/subdir/about.es.html");
      t.assert.strictEqual(urlStem, "/subdir/about.es");

      if (url.match(/\.[a-z]{2}\.html$/i)) {
        // no trailing slash
        return url.slice(0, -1 * ".en.html".length);
      }
    },
  ]);

  t.assert.strictEqual(tp2.toHref(), "/subdir/about");
});
