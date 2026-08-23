import test from "ava";
import Eleventy from "../src/Core.js";

test("addBundle", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("css");
      });
      $config.addTemplate("index.njk", "{% css %}/* Hi */{% endcss %}<style>{% getBundle 'css' %}</style>");
    }
  });

  let results = await elev.toJSON();
  t.is(results[0].content, `<style>/* Hi */</style>`);
});

test("addBundle (empty css)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("css");
      });

      $config.addTemplate("index.njk", "Hi<style>{% getBundle 'css' %}</style>");
    }
  });

  let results = await elev.toJSON();
  t.is(results[0].content, `Hi`);
});

test("addBundle (empty js)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("js");
      });

      $config.addTemplate("index.njk", "Hi<script>{% getBundle 'js' %}</script>");
    }
  });

  let results = await elev.toJSON();
  t.is(results[0].content, `Hi`);
});

test("Empty script node is removed (not using bundle)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("js");
      });

      $config.addTemplate("index.njk", "Hi<script></script>");
    }
  });

  let results = await elev.toJSON();
  t.is(results[0].content, `Hi`);
});


test("Empty style node is removed (not using bundle)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("css");
      });

      $config.addTemplate("index.njk", "Hi<style></style>");
    }
  });

  let results = await elev.toJSON();
  t.is(results[0].content, `Hi`);
});

test("Empty link node is removed (not using bundle)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("css");
      });

      $config.addTemplate("index.njk", "Hi<link rel='stylesheet' href=''>");
    }
  });

  let results = await elev.toJSON();
  t.is(results[0].content, `Hi`);
});

test("Empty link node is removed (no href attribute at all, not using bundle)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("css");
      });

      $config.addTemplate("index.njk", "Hi<link rel='stylesheet'>");
    }
  });

  let results = await elev.toJSON();
  t.is(results[0].content, `Hi`);
});

test("Empty link node is kept (no rel attribute, not using bundle)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("css");
      });

      $config.addTemplate("index.njk", "Hi<link>");
    }
  });

  let results = await elev.toJSON();
  t.is(results[0].content, `Hi<link>`);
});

// Not yet fixed upstream
test.skip("Pagination bundles, https://github.com/11ty/eleventy-plugin-bundle/issues/37", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("blarg");
      });

      $config.addTemplate("paged.njk", `---
pagination:
  data: collections.all
  size: 2
  alias: posts
layout: "layout.njk"
---
Paged{% blarg %}<!-- via paged.njk -->{% endblarg %}{% for post in posts %}<code>{{ post.url }}</code>{% endfor %}`);

      $config.addTemplate("index.njk", "Index{% blarg %}<!-- via index.njk -->{% endblarg %}", { layout: "layout.njk" });
      $config.addTemplate("_includes/layout.njk", `{{ content | safe }}{% getBundle "blarg" %}`);
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 2);
  t.is(results[0].inputPath, `./test/stubs-virtual/paged.njk`);
  t.is(results[0].content, `Paged<code>/</code><!-- via paged.njk -->
<!-- via index.njk -->`);

  t.is(results[1].inputPath, `./test/stubs-virtual/index.njk`);
  t.is(results[1].content, `Index<!-- via index.njk -->`);
});

test("Pagination bundles plucked, https://github.com/11ty/eleventy-plugin-bundle/issues/37", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", undefined, {
    config: $config => {
      $config.addPlugin(() => {
        $config.addBundle("css", {
          bundleHtmlContentFromSelector: "style",
        });
      });

      $config.addTemplate("paged.njk", `---
pagination:
  data: collections.all
  size: 2
  alias: posts
layout: "layout.njk"
---
Paged<style>* { color: blue }</style>{% for post in posts %}{{ post.content | safe }}{% endfor %}`);

      $config.addTemplate("index.njk", "Index<style>* { color: red }</style>", { layout: "layout.njk" });
      $config.addTemplate("_includes/layout.njk", `{{ content | safe }}<style>{% getBundle "css" %}</style>`);
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 2);
  t.is(results[0].inputPath, `./test/stubs-virtual/paged.njk`);
  t.is(results[0].content, `PagedIndex<style>* { color: blue }
* { color: red }</style>`);

  t.is(results[1].inputPath, `./test/stubs-virtual/index.njk`);
  t.is(results[1].content, `Index<style>* { color: red }</style>`);
});
