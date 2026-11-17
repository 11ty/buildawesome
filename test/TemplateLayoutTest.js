import test from "node:test";

import TemplateLayout from "../src/TemplateLayout.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";

import { renderLayoutViaLayout } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

const INHERIT_LAYOUTS = {
  "_includes/layouts/layout-inherit-a.njk": `---
inherits: a
layout: layouts/layout-inherit-b.njk
---
{{content}} {{inherits}}`,
  "_includes/layouts/layout-inherit-b.njk": `---
inherits: b
secondinherits: b
layout: layouts/layout-inherit-c.njk
---
{{ content | safe }} {{secondinherits}}`,
  "_includes/layouts/layout-inherit-c.njk": `---
inherits: c
secondinherits: c
thirdinherits: c
---
{{ content | safe }} {{inherits}} {{thirdinherits}}`,
  "_includes/layouts/layout-contentdump.njk": `---
inherits: a
layout: layouts/layout-inherit-b.njk
---
{{content | default("this is bad")}} {{inherits}}`,
};

async function getTemplateLayoutInstance(key, inputDir, map, virtualTemplates) {
  let eleventyConfig;
  if (virtualTemplates) {
    eleventyConfig = await getTemplateConfigInstanceCustomCallback({ input: inputDir }, (cfg) => {
      for (let [path, content] of Object.entries(virtualTemplates)) {
        cfg.addTemplate(path, content);
      }
    });
  } else {
    eleventyConfig = await getTemplateConfigInstance({
      dir: {
        input: inputDir,
      }
    });
  }

  let mgr = new TemplateEngineManager(eleventyConfig);
  if (!map) {
    map = new ExtensionMap(eleventyConfig);
    map.setFormats(["liquid", "md", "njk", "html", "11ty.js"]);
    map.engineManager = mgr;
  }
  let layout = new TemplateLayout(key, map, eleventyConfig);
  return layout;
}

test("Creation", async (t) => {
  let tl = await getTemplateLayoutInstance("base", "./test/stubs");
  t.assert.strictEqual(tl.getInputPath(), "./test/stubs/_includes/base.njk");

  await t.assert.rejects(async () => {
    await getTemplateLayoutInstance("doesnotexist", "./test/stubs");
  });
});

test("Get Layout Chain", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-inherit-a.njk", "./test/stubs", undefined, INHERIT_LAYOUTS);

  await tl.getData();

  t.assert.deepStrictEqual(await tl.getLayoutChain(), [
    "./test/stubs/_includes/layouts/layout-inherit-a.njk",
    "./test/stubs/_includes/layouts/layout-inherit-b.njk",
    "./test/stubs/_includes/layouts/layout-inherit-c.njk",
  ]);
});

test("Get Front Matter Data", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-inherit-a.njk", "./test/stubs", undefined, INHERIT_LAYOUTS);
  t.assert.strictEqual(tl.getInputPath(), "./test/stubs/_includes/layouts/layout-inherit-a.njk");

  let data = await tl.getData();

  t.assert.deepStrictEqual(data, {
    inherits: "a",
    secondinherits: "b",
    thirdinherits: "c",
  });

  t.assert.deepStrictEqual(await tl.getLayoutChain(), [
    "./test/stubs/_includes/layouts/layout-inherit-a.njk",
    "./test/stubs/_includes/layouts/layout-inherit-b.njk",
    "./test/stubs/_includes/layouts/layout-inherit-c.njk",
  ]);

  t.assert.deepStrictEqual(await tl.getData(), {
    inherits: "a",
    secondinherits: "b",
    thirdinherits: "c",
  });
});

test("Render Layout", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-inherit-a.njk", "./test/stubs", undefined, INHERIT_LAYOUTS);
  t.assert.strictEqual(
    (
      await renderLayoutViaLayout(tl, {
        inherits: "a",
        secondinherits: "b",
        thirdinherits: "c",
      })
    ).trim(),
    "a b a c"
  );
});

test("Render Layout (Pass in template content)", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-inherit-a.njk", "./test/stubs", undefined, INHERIT_LAYOUTS);
  t.assert.strictEqual(
    (
      await renderLayoutViaLayout(tl,
        { inherits: "a", secondinherits: "b", thirdinherits: "c" },
        "TEMPLATE_CONTENT"
      )
    ).trim(),
    "TEMPLATE_CONTENT a b a c"
  );
});

test("Render Layout (Pass in undefined template content)", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-contentdump.njk", "./test/stubs", undefined, INHERIT_LAYOUTS);
  t.assert.strictEqual(
    await renderLayoutViaLayout(tl, { inherits: "a", secondinherits: "b", thirdinherits: "c" }, undefined),
    "this is bad a b a c"
  );
});

test("Render Layout (Pass in null template content)", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-contentdump.njk", "./test/stubs", undefined, INHERIT_LAYOUTS);
  t.assert.strictEqual(
    await renderLayoutViaLayout(tl, { inherits: "a", secondinherits: "b", thirdinherits: "c" }, null),
    " a b a c"
  );
});

test("Render Layout (Pass in empty template content)", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-contentdump.njk", "./test/stubs", undefined, INHERIT_LAYOUTS);
  t.assert.strictEqual(await renderLayoutViaLayout(tl, { inherits: "a", secondinherits: "b", thirdinherits: "c" }, ""), " a b a c");
});

test("Cache Duplicates (use full key for cache)", async (t) => {
  // if two different layouts used the same filename but had different inputdirs, make sure templatelayout cache is unique
  let tla = await getTemplateLayoutInstance(
    "layout.njk",
    "./test/stubs-virtual-nowrite",
    undefined,
    { "_includes/layout.njk": "Hello A" }
  );
  t.assert.strictEqual((await renderLayoutViaLayout(tla, {})).trim(), "Hello A");

  let tlb = await getTemplateLayoutInstance(
    "layout.njk",
    "./test/stubs-empty",
    undefined,
    { "_includes/layout.njk": "Hello B" }
  );
  t.assert.strictEqual((await renderLayoutViaLayout(tlb, {})).trim(), "Hello B");

  t.assert.strictEqual((await renderLayoutViaLayout(tla, {})).trim(), "Hello A");
});

test("Throw an error if a layout references itself as the layout", async (t) => {
  const tl = await getTemplateLayoutInstance("layout-cycle-self.njk", "./test/stubs-virtual-nowrite", undefined, {
    "_includes/layout-cycle-self.njk": `---
layout: layout-cycle-self.njk
---`,
  });

  await t.assert.rejects(() => tl.getLayoutChain(), /circular reference/);
});

test("Throw an error if a circular layout chain is detected", async (t) => {
  const tl = await getTemplateLayoutInstance("layout-cycle-a.njk", "./test/stubs-virtual-nowrite", undefined, {
    "_includes/layout-cycle-a.njk": `---
layout: layout-cycle-b.njk
---`,
    "_includes/layout-cycle-b.njk": `---
layout: layout-cycle-c.njk
---`,
    "_includes/layout-cycle-c.njk": `---
layout: layout-cycle-a.njk
---`,
  });

  await t.assert.rejects(() => tl.getLayoutChain(), /circular reference/);
});
