import test, { describe } from "node:test";
import fs from "node:fs";
import path from "node:path";
import Eleventy from "../src/Core.js";
import PathNormalizer from "../src/Util/PathNormalizer.js";
import RenderPlugin from "../src/Plugins/RenderPlugin.js";
import WebCPlugin from "@11ty/eleventy-plugin-webc";

const ROOT = "test/_generated/incremental-includes";

function createProject(name) {
  let dir = `${ROOT}/${name}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "_includes/nested"), { recursive: true });

  fs.writeFileSync(path.join(dir, "eleventy.config.js"), "export default function($config) {};");

  fs.writeFileSync(path.join(dir, "_includes/layout.njk"), "{% rendered %}<main>{{ content | safe }}</main>");
  fs.writeFileSync(path.join(dir, "_includes/header.njk"), "Header {% include 'nested/logo.njk' %}");
  fs.writeFileSync(path.join(dir, "_includes/nested/logo.njk"), "Logo");
  fs.writeFileSync(path.join(dir, "_includes/macros.njk"), "{% macro hi() %}Hi{% endmacro %}");
  fs.writeFileSync(path.join(dir, "_includes/base.njk"), "Base {% block body %}{% endblock %}");
  fs.writeFileSync(path.join(dir, "_includes/footer.liquid"), "Footer");
  fs.writeFileSync(path.join(dir, "_includes/card.liquid"), "Card {{ name }}");
  fs.writeFileSync(path.join(dir, "_includes/unused.njk"), "Unused");

  fs.writeFileSync(path.join(dir, "header.njk"), "{% rendered %}{% include 'header.njk' %}");
  fs.writeFileSync(path.join(dir, "macros.njk"), "{% rendered %}{% import 'macros.njk' as m %}{{ m.hi() }}");
  fs.writeFileSync(path.join(dir, "extends.njk"), "{% rendered %}{% extends 'base.njk' %}{% block body %}Body{% endblock %}");
  fs.writeFileSync(path.join(dir, "footer.liquid"), "{% rendered %}{% include 'footer' %}");
  fs.writeFileSync(path.join(dir, "card.liquid"), "{% rendered %}{% render 'card', name: 'A' %}");
  fs.writeFileSync(path.join(dir, "markdown.md"), "---\nlayout: layout.njk\n---\n{% rendered %}{% include 'footer.liquid' %}");
  fs.writeFileSync(path.join(dir, "layout.njk"), "---\nlayout: layout.njk\n---\n{% rendered %}Page");
  fs.writeFileSync(path.join(dir, "static.njk"), "{% rendered %}Static");

  return dir;
}

async function getWatchInstance(dir, options = {}) {
  let rendered = new Set();
  let { config, ...eleventyOptions } = options;
  let elev = new Eleventy(dir, `${dir}/_site`, {
    configPath: `${dir}/eleventy.config.js`,
    ...eleventyOptions,
    config($config) {
      $config.addShortcode("rendered", function () {
        rendered.add(this.page.inputPath);
        return "";
      });
      config?.($config);
    },
  });
  elev.disableLogger();
  elev.setIncrementalBuild(options.incremental ?? true);
  elev.setRunMode("watch");
  if (options.ignoreInitial) {
    elev.setIgnoreInitial(true);
  }
  await elev.init();
  await elev.write();

  elev.watcher = { watchTargets() {}, close() {} };
  elev.startWatch = async () => {};

  return {
    elev,
    async trigger(file, content) {
      if (content !== undefined) {
        fs.writeFileSync(path.join(dir, file), content);
      }
      rendered.clear();
      await elev.triggerWatchRunForPath(`./${dir}/${file}`);
      return Array.from(rendered)
        .map((entry) => PathNormalizer.normalizeSeperator(path.relative(dir, entry)))
        .sort();
    },
    read(file) {
      return fs.readFileSync(path.join(dir, "_site", file), "utf8");
    },
  };
}

test.after(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe("Incremental includes", { concurrency: true }, () => {
  test("Nunjucks include change only renders templates that include it", async (t) => {
    let { trigger, read } = await getWatchInstance(createProject("njk-include"));
    t.assert.deepStrictEqual(await trigger("_includes/header.njk", "Header 2 {% include 'nested/logo.njk' %}"), [
      "header.njk",
    ]);
    t.assert.strictEqual(read("header/index.html"), "Header 2 Logo");
  });

  test("Nested Nunjucks include change renders templates that include it transitively", async (t) => {
    let { trigger, read } = await getWatchInstance(createProject("njk-nested"));
    t.assert.deepStrictEqual(await trigger("_includes/nested/logo.njk", "Logo 2"), ["header.njk"]);
    t.assert.strictEqual(read("header/index.html"), "Header Logo 2");
  });

  test("Nunjucks import and extends are tracked", async (t) => {
    let { trigger, read } = await getWatchInstance(createProject("njk-import-extends"));
    t.assert.deepStrictEqual(await trigger("_includes/macros.njk", "{% macro hi() %}Hey{% endmacro %}"), [
      "macros.njk",
    ]);
    t.assert.strictEqual(read("macros/index.html"), "Hey");

    t.assert.deepStrictEqual(await trigger("_includes/base.njk", "Base 2 {% block body %}{% endblock %}"), [
      "extends.njk",
    ]);
    t.assert.strictEqual(read("extends/index.html"), "Base 2 Body");
  });

  test("Liquid include and render are tracked, including from Markdown", async (t) => {
    let { trigger, read } = await getWatchInstance(createProject("liquid"));
    t.assert.deepStrictEqual(await trigger("_includes/footer.liquid", "Footer 2"), [
      "footer.liquid",
      "markdown.md",
    ]);
    t.assert.strictEqual(read("footer/index.html"), "Footer 2");

    t.assert.deepStrictEqual(await trigger("_includes/card.liquid", "Card 2 {{ name }}"), ["card.liquid"]);
    t.assert.strictEqual(read("card/index.html"), "Card 2 A");
  });

  test("Layout change only renders templates that use it", async (t) => {
    let { trigger, read } = await getWatchInstance(createProject("layout"));
    t.assert.deepStrictEqual(
      await trigger("_includes/layout.njk", "{% rendered %}<main class=\"v2\">{{ content | safe }}</main>"),
      ["layout.njk", "markdown.md"],
    );
    t.assert.strictEqual(read("layout/index.html"), `<main class="v2">Page</main>`);
  });

  test("Unused include falls back to a full build", async (t) => {
    let { trigger } = await getWatchInstance(createProject("unused"));
    let rendered = await trigger("_includes/unused.njk", "Unused 2");
    t.assert.strictEqual(rendered.includes("static.njk"), true);
  });

  test("Includes edited after a template changed its includes", async (t) => {
    let { trigger, read } = await getWatchInstance(createProject("template-changed"));
    t.assert.deepStrictEqual(await trigger("header.njk", "{% rendered %}{% include 'footer.liquid' %}"), [
      "header.njk",
    ]);

    t.assert.deepStrictEqual(await trigger("_includes/footer.liquid", "Footer 3"), [
      "footer.liquid",
      "header.njk",
      "markdown.md",
    ]);
    t.assert.strictEqual(read("header/index.html"), "Footer 3");
  });

  test("Include change with --ignore-initial falls back to a full build", async (t) => {
    let { trigger } = await getWatchInstance(createProject("ignore-initial"), {
      ignoreInitial: true,
    });
    t.assert.deepStrictEqual(await trigger("header.njk"), ["header.njk"]);

    // The graph only knows about header.njk, the rest were never rendered
    let rendered = await trigger("_includes/footer.liquid", "Footer 4");
    t.assert.strictEqual(rendered.includes("footer.liquid"), true);
    t.assert.strictEqual(rendered.includes("markdown.md"), true);
  });

  test("Layout added to a template on a later build is tracked", async (t) => {
    let { trigger, read } = await getWatchInstance(createProject("layout-added"));
    t.assert.deepStrictEqual(await trigger("static.njk", "---\nlayout: layout.njk\n---\n{% rendered %}Static"), [
      "static.njk",
    ]);

    let rendered = await trigger("_includes/layout.njk", "<div>{{ content | safe }}</div>");
    t.assert.strictEqual(rendered.includes("static.njk"), true);
    t.assert.strictEqual(read("static/index.html"), "<div>Static</div>");
  });

  test("Include change after a failed build falls back to a full build", async (t) => {
    let { elev, trigger } = await getWatchInstance(createProject("failed"));
    elev.errorHandler.error = () => {};
    await trigger("header.njk", "{% rendered %}{% include 'missing.njk' %}");

    t.assert.deepStrictEqual(await trigger("header.njk", "{% rendered %}Fixed"), ["header.njk"]);
    let rendered = await trigger("_includes/footer.liquid", "Footer 5");
    t.assert.strictEqual(rendered.includes("static.njk"), true);
  });

  test("Nunjucks extends parent edit after two rebuilds is not stale (full builds)", async (t) => {
    let { trigger, read } = await getWatchInstance(createProject("njk-extends-full"), {
      incremental: false,
    });
    await trigger("static.njk", "{% rendered %}Static 2");
    await trigger("_includes/base.njk", "Base 3 {% block body %}{% endblock %}");
    t.assert.strictEqual(read("extends/index.html"), "Base 3 Body");
  });

  test("Global data change nothing reads runs a full build", async (t) => {
    let dir = createProject("global-data");
    fs.mkdirSync(path.join(dir, "_data"));
    fs.writeFileSync(path.join(dir, "_data/site.json"), JSON.stringify({ title: "A" }));
    let { elev, trigger } = await getWatchInstance(dir);

    t.assert.strictEqual(elev.isIncrementalBuildPossible([`./${dir}/_data/site.json`]), false);
    let rendered = await trigger("_data/site.json", JSON.stringify({ title: "B" }));
    t.assert.strictEqual(rendered.includes("static.njk"), true);
  });

  test("Passthrough copy outside the input directory is incremental", async (t) => {
    let dir = createProject("passthrough-outside");
    let assets = `${ROOT}/passthrough-outside-assets`;
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(`${assets}/style.css`, "a{}");

    let { elev } = await getWatchInstance(dir, {
      config($config) {
        $config.addPassthroughCopy({ [assets]: "assets" });
      },
    });

    t.assert.strictEqual(elev.isIncrementalBuildPossible([`./${assets}/style.css`]), true);
  });

  function addDataFiles(dir) {
    fs.mkdirSync(path.join(dir, "blog"), { recursive: true });
    fs.writeFileSync(path.join(dir, "blog/blog.11tydata.json"), JSON.stringify({ name: "Blog", tags: ["blog"] }));
    fs.writeFileSync(path.join(dir, "blog/a.njk"), "{% rendered %}A {{ name }}");
    fs.writeFileSync(path.join(dir, "blog/b.njk"), "{% rendered %}B {{ name }}");
    fs.writeFileSync(path.join(dir, "blog/b.11tydata.js"), `export default { suffix: "!" };`);
    fs.writeFileSync(path.join(dir, "blog/c.njk"), "{% rendered %}C {{ suffix }}");
    fs.writeFileSync(
      path.join(dir, "blog-index.njk"),
      "---\neleventyImport:\n  collections: [blog]\n---\n{% rendered %}{% for p in collections.blog %}{{ p.data.name }} {% endfor %}",
    );
    return dir;
  }

  test("Directory data change only renders templates in that directory", async (t) => {
    let { trigger, read } = await getWatchInstance(addDataFiles(createProject("dir-data")));
    let rendered = await trigger("blog/blog.11tydata.json", JSON.stringify({ name: "News", tags: ["blog"] }));
    t.assert.strictEqual(rendered.includes("blog/a.njk"), true);
    t.assert.strictEqual(rendered.includes("blog/b.njk"), true);
    t.assert.strictEqual(rendered.includes("blog/c.njk"), true);
    t.assert.strictEqual(rendered.includes("static.njk"), false);
    t.assert.strictEqual(read("blog/a/index.html"), "A News");
  });

  // Like a template change, consumers need `eleventyImport.collections`
  test("Directory data change re-renders templates that consume the collection", async (t) => {
    let { trigger, read } = await getWatchInstance(addDataFiles(createProject("dir-data-collection")));
    let rendered = await trigger("blog/blog.11tydata.json", JSON.stringify({ name: "News", tags: ["blog"] }));
    t.assert.strictEqual(rendered.includes("blog-index.njk"), true);
    t.assert.strictEqual(read("blog-index/index.html"), "News News News ");
  });

  test("Template data file change only renders that template", async (t) => {
    let { trigger, read } = await getWatchInstance(addDataFiles(createProject("template-data")));
    let rendered = await trigger("blog/b.11tydata.js", `export default { name: "Bee" };`);
    t.assert.strictEqual(rendered.includes("blog/b.njk"), true);
    t.assert.strictEqual(rendered.includes("blog/a.njk"), false);
    t.assert.strictEqual(rendered.includes("static.njk"), false);
    t.assert.strictEqual(read("blog/b/index.html"), "B Bee");
  });

  test("New directory data file renders the templates it applies to", async (t) => {
    let { trigger, read } = await getWatchInstance(addDataFiles(createProject("new-data")));
    let rendered = await trigger("blog/c.11tydata.json", JSON.stringify({ suffix: "?" }));
    t.assert.strictEqual(rendered.includes("blog/c.njk"), true);
    t.assert.strictEqual(read("blog/c/index.html"), "C ?");
  });

  function addGlobalData(dir) {
    fs.mkdirSync(path.join(dir, "_data/site"), { recursive: true });
    fs.writeFileSync(path.join(dir, "_data/site.json"), JSON.stringify({ title: "Site" }));
    fs.writeFileSync(path.join(dir, "_data/site/meta.json"), JSON.stringify({ author: "Zach" }));
    fs.writeFileSync(path.join(dir, "_data/nav.json"), JSON.stringify([{ title: "One" }, { title: "Two" }]));
    fs.writeFileSync(path.join(dir, "_includes/titled.njk"), "{% rendered %}<title>{{ site.title }}</title>{{ content | safe }}");
    fs.writeFileSync(path.join(dir, "uses-site.njk"), "{% rendered %}{{ site.title }}");
    fs.writeFileSync(path.join(dir, "uses-meta.liquid"), "{% rendered %}{{ site.meta.author }}");
    fs.writeFileSync(path.join(dir, "uses-layout.njk"), "---\nlayout: titled.njk\n---\n{% rendered %}Body");
    fs.writeFileSync(path.join(dir, "paged.njk"), "---\npagination:\n  data: nav\n  size: 1\n---\n{% rendered %}{{ pagination.items[0].title }}");
    return dir;
  }

  test("Global data change only renders templates that read it", async (t) => {
    let { trigger, read } = await getWatchInstance(addGlobalData(createProject("global-reads")));
    t.assert.deepStrictEqual(await trigger("_data/site.json", JSON.stringify({ title: "New" })), [
      "uses-layout.njk",
      "uses-meta.liquid",
      "uses-site.njk",
    ]);
    t.assert.strictEqual(read("uses-site/index.html"), "New");
    t.assert.strictEqual(read("uses-layout/index.html"), "<title>New</title>Body");
  });

  test("Nested global data file renders templates that read its top-level key", async (t) => {
    let { trigger, read } = await getWatchInstance(addGlobalData(createProject("global-nested")));
    let rendered = await trigger("_data/site/meta.json", JSON.stringify({ author: "Z" }));
    t.assert.strictEqual(rendered.includes("uses-meta.liquid"), true);
    t.assert.strictEqual(rendered.includes("paged.njk"), false);
    t.assert.strictEqual(rendered.includes("static.njk"), false);
    t.assert.strictEqual(read("uses-meta/index.html"), "Z");
  });

  test("Global data used for pagination renders the paginated template", async (t) => {
    let { trigger, read } = await getWatchInstance(addGlobalData(createProject("global-pagination")));
    t.assert.deepStrictEqual(
      await trigger("_data/nav.json", JSON.stringify([{ title: "Uno" }, { title: "Dos" }, { title: "Tres" }])),
      ["paged.njk"],
    );
    t.assert.strictEqual(read("paged/2/index.html"), "Tres");
  });

  test("Deleted global data file runs a full build", async (t) => {
    let dir = addGlobalData(createProject("global-deleted"));
    let { trigger, read } = await getWatchInstance(dir);
    fs.rmSync(path.join(dir, "_data/site/meta.json"));
    let rendered = await trigger("_data/site/meta.json");
    t.assert.strictEqual(rendered.includes("static.njk"), true);
    t.assert.strictEqual(read("uses-meta/index.html"), "");
  });

  test("Template edit keeps its data file edges for the next build", async (t) => {
    let { trigger, read } = await getWatchInstance(addDataFiles(createProject("template-then-data")));
    t.assert.strictEqual((await trigger("blog/a.njk", "{% rendered %}A2 {{ name }}")).includes("blog/a.njk"), true);
    let rendered = await trigger("blog/blog.11tydata.json", JSON.stringify({ name: "Later", tags: ["blog"] }));
    t.assert.strictEqual(rendered.includes("blog/a.njk"), true);
    t.assert.strictEqual(read("blog/a/index.html"), "A2 Later");
  });

  test("Global data read through a collection renders the reader", async (t) => {
    let dir = addGlobalData(addDataFiles(createProject("collection-global")));
    fs.writeFileSync(
      path.join(dir, "blog-index.njk"),
      "---\neleventyImport:\n  collections: [blog]\n---\n{% rendered %}{% for p in collections.blog %}{{ p.data.site.title }} {% endfor %}",
    );
    let { trigger, read } = await getWatchInstance(dir);
    let rendered = await trigger("_data/site.json", JSON.stringify({ title: "New" }));
    t.assert.strictEqual(rendered.includes("blog-index.njk"), true);
    t.assert.strictEqual(read("blog-index/index.html"), "New New New ");
  });

  test("Collection consumers render when a template leaves the collection", async (t) => {
    let { trigger, read } = await getWatchInstance(addDataFiles(createProject("collection-leave")));
    let rendered = await trigger("blog/a.njk", "---\noverride:tags: []\n---\n{% rendered %}A {{ name }}");
    t.assert.strictEqual(rendered.includes("blog-index.njk"), true);
    t.assert.strictEqual(read("blog-index/index.html"), "Blog Blog ");
  });

  test("Collection consumers render when directory data removes the tag", async (t) => {
    let { trigger, read } = await getWatchInstance(addDataFiles(createProject("collection-leave-data")));
    let rendered = await trigger("blog/blog.11tydata.json", JSON.stringify({ name: "Blog" }));
    t.assert.strictEqual(rendered.includes("blog-index.njk"), true);
    t.assert.strictEqual(read("blog-index/index.html"), "");
  });

  function addJavaScriptTemplates(dir) {
    fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
    fs.writeFileSync(path.join(dir, "lib/helper.js"), `export default function() { return "Helper"; }`);
    fs.writeFileSync(path.join(dir, "lib/shared.js"), `export default "Shared";`);
    fs.writeFileSync(path.join(dir, "lib/layout-helper.js"), `export default "Layout";`);
    fs.writeFileSync(
      path.join(dir, "page.11ty.js"),
      `import helper from "./lib/helper.js";\nexport default function() { globalThis.renderedJs?.add("page.11ty.js"); return helper(); }`,
    );
    fs.writeFileSync(
      path.join(dir, "_includes/js-layout.11ty.js"),
      `import label from "../lib/layout-helper.js";\nexport default function(data) { return label + " " + data.content; }`,
    );
    fs.writeFileSync(path.join(dir, "uses-js-layout.njk"), "---\nlayout: js-layout.11ty.js\n---\n{% rendered %}Body");
    fs.mkdirSync(path.join(dir, "_data"), { recursive: true });
    fs.writeFileSync(path.join(dir, "_data/shared.js"), `import shared from "../lib/shared.js";\nexport default { value: shared };`);
    fs.writeFileSync(path.join(dir, "uses-shared.njk"), "{% rendered %}{{ shared.value }}");
    return dir;
  }

  // Serial: JavaScript templates record renders on a shared global
  async function getJavaScriptWatchInstance(name) {
    globalThis.renderedJs = new Set();
    let instance = await getWatchInstance(addJavaScriptTemplates(createProject(name)));
    // Watch dependencies are mapped after a build (startWatch is skipped in tests)
    await instance.trigger("static.njk");
    return {
      ...instance,
      async trigger(file, content) {
        globalThis.renderedJs.clear();
        let rendered = await instance.trigger(file, content);
        return [...rendered, ...globalThis.renderedJs].sort();
      },
    };
  }

  // These share globalThis.renderedJs, so they run one at a time.
  describe("JavaScript dependencies", { concurrency: 1 }, () => {
    test("JavaScript template dependency change only renders templates that import it", async (t) => {
      let { trigger, read } = await getJavaScriptWatchInstance("js-deps");
      t.assert.deepStrictEqual(await trigger("lib/helper.js", `export default function() { return "Helper 2"; }`), ["page.11ty.js"]);
      t.assert.strictEqual(read("page/index.html"), "Helper 2");
    });

    test("JavaScript layout dependency change only renders templates using the layout", async (t) => {
      let { trigger, read } = await getJavaScriptWatchInstance("js-layout-deps");
      t.assert.deepStrictEqual(await trigger("lib/layout-helper.js", `export default "Layout 2";`), ["uses-js-layout.njk"]);
      t.assert.strictEqual(read("uses-js-layout/index.html"), "Layout 2 Body");
    });

    test("JavaScript dependency of a data file runs a full build", async (t) => {
      let { trigger, read } = await getJavaScriptWatchInstance("js-data-deps");
      let rendered = await trigger("lib/shared.js", `export default "Shared 2";`);
      t.assert.strictEqual(rendered.includes("static.njk"), true);
      t.assert.strictEqual(read("uses-shared/index.html"), "Shared 2");
    });

    test("JavaScript layout dependencies are watched (#1812)", async (t) => {
      let { elev } = await getJavaScriptWatchInstance("js-layout-watched");
      let { targets } = await elev.getWatchedTargets();
      t.assert.strictEqual(targets.includes("./test/_generated/incremental-includes/js-layout-watched/lib/layout-helper.js"), true);
    });
  });

  for (let includeExtension of ["njk", "md"]) {
    test(`Markdown with Nunjucks includes a .${includeExtension} file, edited repeatedly`, async (t) => {
      let dir = createProject(`md-njk-include-${includeExtension}`);
      fs.writeFileSync(path.join(dir, `_includes/snippet.${includeExtension}`), "Snippet 0");
      fs.writeFileSync(path.join(dir, "md-page.md"), `{% rendered %}{% include "snippet.${includeExtension}" %}`);

      let { trigger, read } = await getWatchInstance(dir, {
        config($config) {
          $config.setMarkdownTemplateEngine("njk");
        },
      });

      for (let i = 1; i <= 3; i++) {
        await trigger(`_includes/snippet.${includeExtension}`, `Snippet ${i}`);
        t.assert.strictEqual(read("md-page/index.html").trim(), `<p>Snippet ${i}</p>`);
      }
    });
  }

  async function getRenderPluginWatchInstance(name) {
    let dir = createProject(name);
    let outside = `${ROOT}/${name}-outside`;
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(`${outside}/doc.md`, "# Doc 0");
    fs.writeFileSync(path.join(dir, "_includes/partial.njk"), "Partial 0");
    fs.writeFileSync(path.join(dir, "_includes/partial.liquid"), "Liquid partial 0");
    fs.writeFileSync(path.join(dir, "render-file.njk"), `{% rendered %}{% renderFile "./${outside}/doc.md" %}`);
    fs.writeFileSync(
      path.join(dir, "render-template-njk.njk"),
      `{% rendered %}{% renderTemplate "njk" %}{% include "partial.njk" %}{% endrenderTemplate %}`,
    );
    fs.writeFileSync(
      path.join(dir, "render-template-liquid.liquid"),
      `{% rendered %}{% renderTemplate "liquid" %}{% include "partial.liquid" %}{% endrenderTemplate %}`,
    );
    // A normal page also uses the include, so it is tracked
    fs.writeFileSync(path.join(dir, "uses-partial.njk"), `{% rendered %}{% include "partial.njk" %}`);
    fs.writeFileSync(path.join(dir, "uses-partial-liquid.liquid"), `{% rendered %}{% include "partial.liquid" %}`);

    let instance = await getWatchInstance(dir, {
      config($config) {
        $config.addPlugin(RenderPlugin);
        $config.addWatchTarget(`${outside}/**/*.md`);
      },
    });
    return { ...instance, outside };
  }

  test("renderFile renders again when the rendered file changes (#2909)", async (t) => {
    let { trigger, read, outside, elev } = await getRenderPluginWatchInstance("render-file");
    for (let i = 1; i <= 2; i++) {
      fs.writeFileSync(`${outside}/doc.md`, `# Doc ${i}`);
      await elev.triggerWatchRunForPath(`./${outside}/doc.md`);
      t.assert.strictEqual(read("render-file/index.html").trim(), `<h1>Doc ${i}</h1>`);
    }
    t.assert.strictEqual(elev.isIncrementalBuildPossible([`./${outside}/doc.md`]), true);
  });

  test("renderTemplate includes are tracked (Nunjucks)", async (t) => {
    let { trigger, read } = await getRenderPluginWatchInstance("render-template-njk");
    let rendered = await trigger("_includes/partial.njk", "Partial 1");
    t.assert.strictEqual(rendered.includes("render-template-njk.njk"), true);
    t.assert.strictEqual(rendered.includes("static.njk"), false);
    t.assert.strictEqual(read("render-template-njk/index.html"), "Partial 1");
  });

  test("renderTemplate includes are tracked (Liquid)", async (t) => {
    let { trigger, read } = await getRenderPluginWatchInstance("render-template-liquid");
    let rendered = await trigger("_includes/partial.liquid", "Liquid partial 1");
    t.assert.strictEqual(rendered.includes("render-template-liquid.liquid"), true);
    t.assert.strictEqual(rendered.includes("static.njk"), false);
    t.assert.strictEqual(read("render-template-liquid/index.html"), "Liquid partial 1");
  });

  test("renderTemplate WebC components are tracked", async (t) => {
    let dir = createProject("render-template-webc");
    fs.mkdirSync(path.join(dir, "_components"));
    fs.writeFileSync(path.join(dir, "_components/main-button.webc"), "<button>Button 0</button>");
    fs.writeFileSync(
      path.join(dir, "uses-webc.liquid"),
      `{% rendered %}{% renderTemplate "webc" %}<main-button></main-button>{% endrenderTemplate %}`,
    );
    let { trigger, read } = await getWatchInstance(dir, {
      config($config) {
        $config.addPlugin(WebCPlugin, { components: `${dir}/_components/**/*.webc` });
        $config.addPlugin(RenderPlugin);
      },
    });

    for (let i = 1; i <= 2; i++) {
      let rendered = await trigger("_components/main-button.webc", `<button>Button ${i}</button>`);
      t.assert.strictEqual(rendered.includes("uses-webc.liquid"), true);
      t.assert.strictEqual(rendered.includes("static.njk"), false);
      t.assert.strictEqual(read("uses-webc/index.html").trim(), `<button>Button ${i}</button>`);
    }
  });
});
