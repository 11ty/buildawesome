import test from "ava";

import TemplateLayout from "../src/TemplateLayout.js";
import ExtensionMap from "../src/ExtensionMap.js";
import TemplateEngineManager from "../src/Engines/TemplateEngineManager.js";

import { renderLayoutViaLayout } from "./_getRenderedTemplates.js";
import { getTemplateConfigInstance } from "./_testHelpers.js";

async function getTemplateLayoutInstance(key, inputDir, map) {
  let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: inputDir,
		}
	});

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
  t.is(tl.getInputPath(), "./test/stubs/_includes/base.njk");

  await t.throwsAsync(async () => {
    await getTemplateLayoutInstance("doesnotexist", "./test/stubs");
  });
});

test("Get Layout Chain", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-inherit-a.njk", "./test/stubs");

  await tl.getData();

  t.deepEqual(await tl.getLayoutChain(), [
    "./test/stubs/_includes/layouts/layout-inherit-a.njk",
    "./test/stubs/_includes/layouts/layout-inherit-b.njk",
    "./test/stubs/_includes/layouts/layout-inherit-c.njk",
  ]);
});

test("Get Front Matter Data", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-inherit-a.njk", "./test/stubs");
  t.is(tl.getInputPath(), "./test/stubs/_includes/layouts/layout-inherit-a.njk");

  let data = await tl.getData();

  t.deepEqual(data, {
    inherits: "a",
    secondinherits: "b",
    thirdinherits: "c",
  });

  t.deepEqual(await tl.getLayoutChain(), [
    "./test/stubs/_includes/layouts/layout-inherit-a.njk",
    "./test/stubs/_includes/layouts/layout-inherit-b.njk",
    "./test/stubs/_includes/layouts/layout-inherit-c.njk",
  ]);

  t.deepEqual(await tl.getData(), {
    inherits: "a",
    secondinherits: "b",
    thirdinherits: "c",
  });
});

test("Render Layout", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-inherit-a.njk", "./test/stubs");
  t.is(
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
  let tl = await getTemplateLayoutInstance("layouts/layout-inherit-a.njk", "./test/stubs");
  t.is(
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
  let tl = await getTemplateLayoutInstance("layouts/layout-contentdump.njk", "./test/stubs");
  t.is(
    await renderLayoutViaLayout(tl, { inherits: "a", secondinherits: "b", thirdinherits: "c" }, undefined),
    "this is bad a b a c"
  );
});

test("Render Layout (Pass in null template content)", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-contentdump.njk", "./test/stubs");
  t.is(
    await renderLayoutViaLayout(tl, { inherits: "a", secondinherits: "b", thirdinherits: "c" }, null),
    " a b a c"
  );
});

test("Render Layout (Pass in empty template content)", async (t) => {
  let tl = await getTemplateLayoutInstance("layouts/layout-contentdump.njk", "./test/stubs");
  t.is(await renderLayoutViaLayout(tl, { inherits: "a", secondinherits: "b", thirdinherits: "c" }, ""), " a b a c");
});

test("Cache Duplicates (use full key for cache)", async (t) => {
  // if two different layouts used the same filename but had different inputdirs, make sure templatelayout cache is unique
  let tla = await getTemplateLayoutInstance(
    "layout.njk",
    "./test/stubs/templateLayoutCacheDuplicates"
  );
  t.is((await renderLayoutViaLayout(tla, {})).trim(), "Hello A");

  let tlb = await getTemplateLayoutInstance(
    "layout.njk",
    "./test/stubs/templateLayoutCacheDuplicates-b"
  );
  t.is((await renderLayoutViaLayout(tlb, {})).trim(), "Hello B");

  t.is((await renderLayoutViaLayout(tla, {})).trim(), "Hello A");
});

test("Throw an error if a layout references itself as the layout", async (t) => {
  await t.throwsAsync(async () => {
    const tl = await getTemplateLayoutInstance(
      "layout-cycle-self.njk",
      "./test/stubs-circular-layout"
    );

    const layoutChain = await tl._testGetLayoutChain();
    return layoutChain;
  });
});

test("Throw an error if a circular layout chain is detected", async (t) => {
  await t.throwsAsync(async () => {
    const tl = await getTemplateLayoutInstance(
      "layout-cycle-a.njk",
      "./test/stubsstubs-circular-layout"
    );
    const layoutChain = await tl._testGetLayoutChain();
    return layoutChain;
  });
});
