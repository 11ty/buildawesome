import test from "ava";

import TemplateLayoutPathResolver from "../src/TemplateLayoutPathResolver.js";
import ExtensionMap from "../src/ExtensionMap.js";

import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

async function getResolverInstance(path, inputDir, { eleventyConfig, map } = {}) {
  if (!eleventyConfig) {
    eleventyConfig = await getTemplateConfigInstance({
      dir: {
        input: inputDir
      }
    });
  }

  if (!map) {
    map = new ExtensionMap(eleventyConfig);
    map.setFormats(["liquid", "md", "njk", "html", "11ty.js"]);
  }

  return new TemplateLayoutPathResolver(path, map, eleventyConfig);
}

test("Layout", async (t) => {
  let res = await getResolverInstance("default", "./test/stubs");
  t.is(res.getFileName(), "default.liquid");
});

test("Layout already has extension", async (t) => {
  let res = await getResolverInstance("default.liquid", "./test/stubs");
  t.is(res.getFileName(), "default.liquid");
});

test("Layout (uses empty string includes folder)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    templateFormats: ["liquid"],
    dir: {
      input: "test/stubs",
      includes: ""
    }
  });

  let res = await getResolverInstance("includesemptystring", "./test/stubs", {
    eleventyConfig,
  });

  t.is(res.getFileName(), "includesemptystring.liquid");
});

test("Layout (uses empty string includes folder) already has extension", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    templateFormats: ["liquid"],
    dir: {
      input: "test/stubs",
      includes: ""
    }
  });

  let res = await getResolverInstance("includesemptystring.liquid", "./test/stubs", {
    eleventyConfig,
  });

  t.is(res.getFileName(), "includesemptystring.liquid");
});

test("Layout (uses layouts folder)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    templateFormats: ["liquid"],
    dir: {
      input: "test/stubs",
      layouts: "_layouts",
      includes: "_includes",
    }
  });

  let res = await getResolverInstance("layoutsdefault", "./test/stubs", {
    eleventyConfig,
  });

  t.is(res.getFileName(), "layoutsdefault.liquid");
});

test("Layout (uses layouts folder) already has extension", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    templateFormats: ["liquid"],
    dir: {
      input: "test/stubs",
      layouts: "_layouts",
    }
  });

  let res = await getResolverInstance("layoutsdefault.liquid", "./test/stubs", {
    eleventyConfig,
  });

  t.is(res.getFileName(), "layoutsdefault.liquid");
});

test("Layout (uses empty string layouts folder)", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    templateFormats: ["liquid"],
    dir: {
      input: "test/stubs",
      layouts: "",
    }
  });

  let res = await getResolverInstance("layoutsemptystring", "./test/stubs", {
    eleventyConfig,
  });

  t.is(res.getFileName(), "layoutsemptystring.liquid");
});

test("Layout (uses empty string layouts folder) no template resolution", async (t) => {
  let eleventyConfig = await getTemplateConfigInstanceCustomCallback({
    input: "test/stubs",
    layouts: ""
  }, function(cfg) {
    cfg.setLayoutResolution(false);
  });

  let res = await getResolverInstance("layoutsemptystring", "./test/stubs", {
    eleventyConfig,
  });

  t.throws(() => {
    res.getFileName();
  }, {
    message: `You’re trying to use a layout that does not exist: test/stubs/layoutsemptystring (via \`layout: layoutsemptystring\`)`
  });
});

test("Layout (uses empty string layouts folder) already has extension", async (t) => {
  let eleventyConfig = await getTemplateConfigInstance({
    templateFormats: ["liquid"],
    dir: {
      input: "test/stubs",
      layouts: "",
    }
  });

  let res = await getResolverInstance("layoutsemptystring.liquid", "./test/stubs", {
    eleventyConfig,
  });

  t.is(res.getFileName(), "layoutsemptystring.liquid");
});

test("Layout subdir", async (t) => {
  let res = await getResolverInstance("layouts/inasubdir", "./test/stubs");
  t.is(res.getFileName(), "layouts/inasubdir.njk");
});

test("Layout subdir already has extension", async (t) => {
  let res = await getResolverInstance("layouts/inasubdir.njk", "./test/stubs");
  t.is(res.getFileName(), "layouts/inasubdir.njk");
});

test("Multiple layouts exist with the same file base, pick one", async (t) => {
  let res = await getResolverInstance("multiple", "./test/stubs");
  // pick the first one if multiple exist.
  t.is(res.getFileName(), "multiple.liquid");
});

test("Multiple layouts exist but we are being explicit—layout already has extension", async (t) => {
  let res = await getResolverInstance("multiple.liquid", "./test/stubs");
  t.is(res.getFileName(), "multiple.liquid");

  let res2 = await getResolverInstance("multiple.md", "./test/stubs");
  t.is(res2.getFileName(), "multiple.md");
});

test("Layout is aliased to a new location", async (t) => {
  let tl = await getResolverInstance("post", "./test/stubs");
  tl.addLayoutAlias("post", "layouts/post.liquid");
  tl.init();

  t.is(tl.getFileName(), "layouts/post.liquid");
});

test("Global default with empty string alias", async (t) => {
  let tl = await getResolverInstance("", "./test/stubs");
  tl.addLayoutAlias("", "layouts/post.liquid");
  tl.init();

  t.is(tl.getFileName(), "layouts/post.liquid");
});

test("Global default with empty string alias (but no alias exists for this instance)", async (t) => {
  let tl = await getResolverInstance("layout.liquid", "./test/stubs");
  tl.addLayoutAlias("", "layouts/post.liquid");
  tl.init();

  t.throws(() => {
    tl.getFileName();
  });
});

test("Layout has no alias and does not exist", async (t) => {
  let tl = await getResolverInstance("shouldnotexist", "./test/stubs");
  tl.addLayoutAlias("post", "layouts/post.liquid");
  tl.init();

  t.throws(() => {
    tl.getFileName();
  });

  t.throws(() => {
    tl.getFullPath();
  });
});
