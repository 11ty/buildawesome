import test from "ava";
import fs from "node:fs";
import path from "node:path";
import Eleventy from "../src/Core.js";

const ROOT = "test/stubs-incremental-includes";

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
  let elev = new Eleventy(dir, `${dir}/_site`, {
    configPath: `${dir}/eleventy.config.js`,
    config($config) {
      $config.addShortcode("rendered", function () {
        rendered.add(this.page.inputPath);
        return "";
      });
    },
    ...options,
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
        .map((entry) => path.relative(dir, entry))
        .sort();
    },
    read(file) {
      return fs.readFileSync(path.join(dir, "_site", file), "utf8");
    },
  };
}

test.after.always(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
});

test("Nunjucks include change only renders templates that include it", async (t) => {
  let { trigger, read } = await getWatchInstance(createProject("njk-include"));
  t.deepEqual(await trigger("_includes/header.njk", "Header 2 {% include 'nested/logo.njk' %}"), [
    "header.njk",
  ]);
  t.is(read("header/index.html"), "Header 2 Logo");
});

test("Nested Nunjucks include change renders templates that include it transitively", async (t) => {
  let { trigger, read } = await getWatchInstance(createProject("njk-nested"));
  t.deepEqual(await trigger("_includes/nested/logo.njk", "Logo 2"), ["header.njk"]);
  t.is(read("header/index.html"), "Header Logo 2");
});

test("Nunjucks import and extends are tracked", async (t) => {
  let { trigger, read } = await getWatchInstance(createProject("njk-import-extends"));
  t.deepEqual(await trigger("_includes/macros.njk", "{% macro hi() %}Hey{% endmacro %}"), [
    "macros.njk",
  ]);
  t.is(read("macros/index.html"), "Hey");

  t.deepEqual(await trigger("_includes/base.njk", "Base 2 {% block body %}{% endblock %}"), [
    "extends.njk",
  ]);
  t.is(read("extends/index.html"), "Base 2 Body");
});

test("Liquid include and render are tracked, including from Markdown", async (t) => {
  let { trigger, read } = await getWatchInstance(createProject("liquid"));
  t.deepEqual(await trigger("_includes/footer.liquid", "Footer 2"), [
    "footer.liquid",
    "markdown.md",
  ]);
  t.is(read("footer/index.html"), "Footer 2");

  t.deepEqual(await trigger("_includes/card.liquid", "Card 2 {{ name }}"), ["card.liquid"]);
  t.is(read("card/index.html"), "Card 2 A");
});

test("Layout change only renders templates that use it", async (t) => {
  let { trigger, read } = await getWatchInstance(createProject("layout"));
  t.deepEqual(
    await trigger("_includes/layout.njk", "{% rendered %}<main class=\"v2\">{{ content | safe }}</main>"),
    ["layout.njk", "markdown.md"],
  );
  t.is(read("layout/index.html"), `<main class="v2">Page</main>`);
});

test("Unused include falls back to a full build", async (t) => {
  let { trigger } = await getWatchInstance(createProject("unused"));
  let rendered = await trigger("_includes/unused.njk", "Unused 2");
  t.true(rendered.includes("static.njk"));
});

test("Includes edited after a template changed its includes", async (t) => {
  let { trigger, read } = await getWatchInstance(createProject("template-changed"));
  t.deepEqual(await trigger("header.njk", "{% rendered %}{% include 'footer.liquid' %}"), [
    "header.njk",
  ]);

  t.deepEqual(await trigger("_includes/footer.liquid", "Footer 3"), [
    "footer.liquid",
    "header.njk",
    "markdown.md",
  ]);
  t.is(read("header/index.html"), "Footer 3");
});

test("Include change with --ignore-initial falls back to a full build", async (t) => {
  let { trigger } = await getWatchInstance(createProject("ignore-initial"), {
    ignoreInitial: true,
  });
  t.deepEqual(await trigger("header.njk"), ["header.njk"]);

  // The graph only knows about header.njk, the rest were never rendered
  let rendered = await trigger("_includes/footer.liquid", "Footer 4");
  t.true(rendered.includes("footer.liquid"));
  t.true(rendered.includes("markdown.md"));
});

test("Layout added to a template on a later build is tracked", async (t) => {
  let { trigger, read } = await getWatchInstance(createProject("layout-added"));
  t.deepEqual(await trigger("static.njk", "---\nlayout: layout.njk\n---\n{% rendered %}Static"), [
    "static.njk",
  ]);

  let rendered = await trigger("_includes/layout.njk", "<div>{{ content | safe }}</div>");
  t.true(rendered.includes("static.njk"));
  t.is(read("static/index.html"), "<div>Static</div>");
});

test("Include change after a failed build falls back to a full build", async (t) => {
  let { elev, trigger } = await getWatchInstance(createProject("failed"));
  elev.errorHandler.error = () => {};
  await trigger("header.njk", "{% rendered %}{% include 'missing.njk' %}");

  t.deepEqual(await trigger("header.njk", "{% rendered %}Fixed"), ["header.njk"]);
  let rendered = await trigger("_includes/footer.liquid", "Footer 5");
  t.true(rendered.includes("static.njk"));
});

test("Nunjucks extends parent edit after two rebuilds is not stale (full builds)", async (t) => {
  let { trigger, read } = await getWatchInstance(createProject("njk-extends-full"), {
    incremental: false,
  });
  await trigger("static.njk", "{% rendered %}Static 2");
  await trigger("_includes/base.njk", "Base 3 {% block body %}{% endblock %}");
  t.is(read("extends/index.html"), "Base 3 Body");
});

test("Global data change runs a full build", async (t) => {
  let dir = createProject("global-data");
  fs.mkdirSync(path.join(dir, "_data"));
  fs.writeFileSync(path.join(dir, "_data/site.json"), JSON.stringify({ title: "A" }));
  let { elev, trigger } = await getWatchInstance(dir);

  t.false(elev.isIncrementalBuildPossible([`./${dir}/_data/site.json`]));
  let rendered = await trigger("_data/site.json", JSON.stringify({ title: "B" }));
  t.true(rendered.includes("static.njk"));
});

test("Passthrough copy outside the input directory is incremental", async (t) => {
  let dir = createProject("passthrough-outside");
  let assets = `${ROOT}/passthrough-outside-assets`;
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(`${assets}/style.css`, "a{}");

  let { elev } = await getWatchInstance(dir, {
    config($config) {
      $config.addShortcode("rendered", () => "");
      $config.addPassthroughCopy({ [assets]: "assets" });
    },
  });

  t.true(elev.isIncrementalBuildPossible([`./${assets}/style.css`]));
});
