import test from "ava";
import fs from "node:fs";
import path from "node:path";
import Eleventy from "../src/Core.js";

const ROOT = "test/stubs-nunjucks-watch";

function getPagedTemplate({ permalink = "/paged/{{ item }}/", body = "" } = {}) {
  return `---
pagination:
  data: letters
  size: 1
  alias: item
letters: [a, b]
permalink: "${permalink}"
layout: layout.njk
---
{% import "macros.njk" as m %}{% include "item.njk" %}{{ m.label(item) }}${body}`;
}

function createProject(name) {
  let dir = `${ROOT}/${name}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "_includes"), { recursive: true });
  fs.writeFileSync(path.join(dir, "eleventy.config.js"), "export default function($config) {};");
  fs.writeFileSync(path.join(dir, "_includes/layout.njk"), "<main>{{ content | safe }}</main>");
  fs.writeFileSync(path.join(dir, "_includes/item.njk"), "<b>{{ item }}</b>");
  fs.writeFileSync(path.join(dir, "_includes/macros.njk"), "{% macro label(x) %}[{{ x }}]{% endmacro %}");
  fs.writeFileSync(path.join(dir, "paged.njk"), getPagedTemplate());
  fs.writeFileSync(path.join(dir, "page.njk"), "Page {{ 'one' }}");
  // Identical content in two files, compile cache entries are per input path
  fs.writeFileSync(path.join(dir, "twin-a.njk"), "Twin {{ page.fileSlug }}");
  fs.writeFileSync(path.join(dir, "twin-b.njk"), "Twin {{ page.fileSlug }}");
  return dir;
}

async function getWatchInstance(dir, { incremental }) {
  let elev = new Eleventy(dir, `${dir}/_site`, {
    configPath: `${dir}/eleventy.config.js`,
  });
  elev.disableLogger();
  elev.setRunMode("serve");
  elev.setIncrementalBuild(incremental);
  await elev.init();

  // Initial build, without starting chokidar
  await elev.write();

  elev.watcher = { watchTargets() {}, close() {} };
  elev.startWatch = async () => {};
  elev.eleventyServe.reload = async () => {};
  elev.eleventyServe.sendError = ({ error }) => {
    throw error;
  };

  return elev;
}

function read(dir, url) {
  return fs.readFileSync(path.join(dir, "_site", url, "index.html"), "utf8");
}

async function edit(elev, dir, file, content) {
  fs.writeFileSync(path.join(dir, file), content);
  await elev.triggerWatchRunForPath(`./${dir}/${file}`);
}

test.after.always(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
});

for (let incremental of [false, true]) {
  let mode = incremental ? "incremental" : "full";

  test(`Editing a paginated Nunjucks template updates every page (${mode})`, async (t) => {
    let dir = createProject(`template-${mode}`);
    let elev = await getWatchInstance(dir, { incremental });
    t.is(read(dir, "/paged/b/"), "<main><b>b</b>[b]</main>");

    await edit(elev, dir, "paged.njk", getPagedTemplate({ body: " edited" }));

    t.is(read(dir, "/paged/a/"), "<main><b>a</b>[a] edited</main>");
    t.is(read(dir, "/paged/b/"), "<main><b>b</b>[b] edited</main>");
  });

  test(`Editing a paginated Nunjucks permalink writes the new URLs (${mode})`, async (t) => {
    let dir = createProject(`permalink-${mode}`);
    let elev = await getWatchInstance(dir, { incremental });

    await edit(elev, dir, "paged.njk", getPagedTemplate({ permalink: "/letters/{{ item }}/" }));

    t.is(read(dir, "/letters/a/"), "<main><b>a</b>[a]</main>");
    t.is(read(dir, "/letters/b/"), "<main><b>b</b>[b]</main>");
  });

  test(`Editing a Nunjucks include updates paginated pages (${mode})`, async (t) => {
    let dir = createProject(`include-${mode}`);
    let elev = await getWatchInstance(dir, { incremental });

    await edit(elev, dir, "_includes/item.njk", "<i>{{ item }}</i>");

    t.is(read(dir, "/paged/a/"), "<main><i>a</i>[a]</main>");
    t.is(read(dir, "/paged/b/"), "<main><i>b</i>[b]</main>");
  });

  test(`Editing an imported Nunjucks macro updates paginated pages (${mode})`, async (t) => {
    let dir = createProject(`macro-${mode}`);
    let elev = await getWatchInstance(dir, { incremental });

    await edit(elev, dir, "_includes/macros.njk", "{% macro label(x) %}({{ x }}){% endmacro %}");

    t.is(read(dir, "/paged/a/"), "<main><b>a</b>(a)</main>");
    t.is(read(dir, "/paged/b/"), "<main><b>b</b>(b)</main>");
  });

  test(`Editing a Nunjucks layout updates paginated pages (${mode})`, async (t) => {
    let dir = createProject(`layout-${mode}`);
    let elev = await getWatchInstance(dir, { incremental });

    await edit(elev, dir, "_includes/layout.njk", "<article>{{ content | safe }}</article>");

    t.is(read(dir, "/paged/a/"), "<article><b>a</b>[a]</article>");
    t.is(read(dir, "/paged/b/"), "<article><b>b</b>[b]</article>");
  });

  test(`Editing a Nunjucks page updates it (${mode})`, async (t) => {
    let dir = createProject(`page-${mode}`);
    let elev = await getWatchInstance(dir, { incremental });
    t.is(read(dir, "/page/"), "Page one");

    await edit(elev, dir, "page.njk", "Page {{ 'two' }}");

    t.is(read(dir, "/page/"), "Page two");
  });

  test(`Editing one of two identical Nunjucks templates leaves the other alone (${mode})`, async (t) => {
    let dir = createProject(`twins-${mode}`);
    let elev = await getWatchInstance(dir, { incremental });

    await edit(elev, dir, "twin-a.njk", "Edited {{ page.fileSlug }}");

    t.is(read(dir, "/twin-a/"), "Edited twin-a");
    t.is(read(dir, "/twin-b/"), "Twin twin-b");
  });
}
