import test from "node:test";
import fs from "fs";

import TemplateData from "../src/Data/TemplateData.js";
import getNewTemplate from "./_getNewTemplateForTests.js";
import Core from "../src/Core.js";

import { getTemplateConfigInstance, getTemplateConfigInstanceCustomCallback } from "./_testHelpers.js";

async function getVirtualTemplate(path, inputDir, outputDir, content) {
  let $config = await getTemplateConfigInstanceCustomCallback({ input: inputDir, output: outputDir }, (cfg) => {
    cfg.addTemplate(path.slice(inputDir.length), content);
  });
  return getNewTemplate(path, inputDir, outputDir, null, null, $config);
}

async function writeMapEntry(entry) {
  let promises = [];
  if (entry.template.behavior.isWriteable()) {
    promises.push(entry.template._write(entry.outputPath, entry.templateContent));
  }
  return Promise.all(promises);
}

async function getTemplateMapEntryWithContent(template, data) {
  let entry = await template.getTemplateMapEntry(data);

  entry._pages = await entry.template.getTemplates(entry.data);
  await Promise.all(
    entry._pages.map(async (page) => {
      page.templateContent = await page.template.renderPageEntryWithoutLayout(page);
      return page;
    })
  );

  return entry;
}

test("permalink: false", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs/permalink-false/test.md",
    "./test/stubs/",
    "./test/stubs/_site",
    `---
permalink: false
---

This shouldn’t write
`
  );

  let data = await tmpl.getData();

  let entry = await getTemplateMapEntryWithContent(tmpl, data);
  t.assert.strictEqual(entry.template.behavior.isWriteable(), false);
  t.assert.strictEqual(entry.data.page.url, false);
  t.assert.strictEqual(entry.data.page.outputPath, false);

  await writeMapEntry(entry);

  // Output does not exist
  t.assert.strictEqual(fs.existsSync("./test/stubs/_site/permalink-false/"), false);
  t.assert.strictEqual(fs.existsSync("./test/stubs/_site/permalink-false/test/"), false);
  t.assert.strictEqual(fs.existsSync("./test/stubs/_site/permalink-false/test/index.html"), false);
});

test("permalink: false inside of eleventyComputed, Issue #1754", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs/permalink-false-computed/test.md",
    "./test/stubs/",
    "./test/stubs/_site",
    `---
eleventyComputed:
  permalink: false
---

This shouldn’t write
`
  );

  let data = await tmpl.getData();
  let entry = await getTemplateMapEntryWithContent(tmpl, data);
  t.assert.strictEqual(entry.template.behavior.isWriteable(), false);
  t.assert.strictEqual(entry.data.page.url, false);
  t.assert.strictEqual(entry.data.page.outputPath, false);

  await writeMapEntry(entry);

  // Output does not exist
  t.assert.strictEqual(fs.existsSync("./test/stubs/_site/permalink-false-computed/"), false);
  t.assert.strictEqual(fs.existsSync("./test/stubs/_site/permalink-false-computed/test/"), false);
  t.assert.strictEqual(fs.existsSync("./test/stubs/_site/permalink-false-computed/test/index.html"), false);
});

test("permalink: true", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs/permalink-true/permalink-true.md",
    "./test/stubs/",
    "./test/stubs/_site",
    `---
permalink: true
---

This should throw an error.
`
  );

  let data = await tmpl.getData();
  await t.assert.rejects(async () => {
    await tmpl.getRawOutputPath(data);
  });
});

test("Disable dynamic permalinks", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs/dynamic-permalink/test.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    `---
permalink: "/{{justastring}}/"
dynamicPermalink: false
---`
  );
  let data = await tmpl.getData();

  t.assert.strictEqual(await tmpl.getRawOutputPath(data), "/{{justastring}}/index.html");
  t.assert.strictEqual(await tmpl.getOutputHref(data), "/{{justastring}}/");
  // TODO https://github.com/11ty/eleventy-plugin-webc/issues/32
  // t.assert.strictEqual(data.page.url, "/{{justastring}}/")
});

test("Permalink with variables!", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs/permalinkdata.njk",
    "./test/stubs/",
    "./dist",
    `---
title: Slug CANDIDATE
permalink: subdir/{{ title | slugify }}/index.html
---
Slugged.
`
  );

  let data = await tmpl.getData();

  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/slug-candidate/index.html");
});

test("Permalink with variables and JS front matter!", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs/permalinkdata-jsfn.njk",
    "./test/stubs/",
    "./dist",
    `---js
{
	title: "slug",
	permalink: "subdir/{{title}}/"
}
---
Slugged.
`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/slug/index.html");
});

test("Use a JavaScript function for permalink in any template language", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs/permalinkdata-jspermalinkfn.njk",
    "./test/stubs/",
    "./dist",
    `---js
{
	title: "slug",
	permalink: function(data) {
		return \`subdir/\${data.title}/\`;
	}
}
---
Slugged.
`
  );

  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/slug/index.html");
});

test("Permalink with dates!", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs/permalinkdate.liquid",
    "./test/stubs/",
    "./dist",
    `---
title: Date Permalink
date: "2016-01-01T06:00-06:00"
permalink: "/{{ page.date | date: '%Y/%m/%d' }}/index.html"
---
Date Permalinks`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/2016/01/01/index.html");
});

test("Permalink with dates on file name regex!", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs/2016-02-01-permalinkdate.liquid",
    "./test/stubs/",
    "./dist",
    `---
title: Date Permalink
permalink: "/{{ page.date | date: '%Y/%m/%d' }}/index.html"
---
Date Permalinks`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/2016/02/01/index.html");
});

test("Reuse permalink in directory specific data file", async (t) => {
	let eleventyConfig = await getTemplateConfigInstance({
		dir: {
			input: "test/stubs",
			output: "dist"
		}
	});

  let dataObj = new TemplateData(eleventyConfig);
  dataObj.setProjectUsingEsm(true);
  let tmpl = await getNewTemplate(
    "./test/stubs/reuse-permalink/test1.liquid",
    "./test/stubs/",
    "./dist",
    dataObj
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/2016/01/01/index.html");
});

test("Using slugify filter!", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs-virtual-nowrite/test.njk",
    "./test/stubs-virtual-nowrite/",
    "./dist",
    `---
title: _Slug ♥ CANDIDATE люблю $#%-
permalink: subdir/{{ title | slugify }}/index.html
---
Slugged.
`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/slug-love-candidate-lyublyu/index.html");
});

test("Using slugify filter with comma and apostrophe", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs-virtual-nowrite/comma.njk",
    "./test/stubs-virtual-nowrite/",
    "./dist",
    `---
title: "Hi, I'm ZAch"
permalink: subdir/{{ title | slugify }}/index.html
---
Slugged.
`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/hi-i-m-zach/index.html");
});

test("Using slug filter with options params", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs-virtual-nowrite/slug-options.njk",
    "./test/stubs-virtual-nowrite/",
    "./dist",
    `---
title: "Hi, I am ZAch"
permalink: "subdir/{{ title | slugify({separator:'_'}) }}/index.html"
---
Slugged.
`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/hi_i_am_zach/index.html");
});

test("Using slugify filter with options params", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs-virtual-nowrite/slugify-options.njk",
    "./test/stubs-virtual-nowrite/",
    "./dist",
    `---
title: "Hi, I'm ZAch"
permalink: "subdir/{{ title | slugify({decamelize: true}) }}/index.html"
---
Slugged.
`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/hi-i-m-z-ach/index.html");
});

test("Using slugify filter with a number #854", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs-virtual-nowrite/slugify-number.njk",
    "./test/stubs-virtual-nowrite/",
    "./dist",
    `---
number: 1
permalink: subdir/{{ number | slugify }}/index.html
---
Slugged.
`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/1/index.html");
});

test("Using slug filter with a number #854", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs-virtual-nowrite/slug-number.njk",
    "./test/stubs-virtual-nowrite/",
    "./dist",
    `---
number: 1
permalink: subdir/{{ number | slugify }}/index.html
---
Slugged.
`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/1/index.html");
});

test.skip("Using slugify filter with multibyte", async (t) => {
  let tmpl = await getVirtualTemplate(
    "./test/stubs-virtual-nowrite/multibyte.njk",
    "./test/stubs-virtual-nowrite/",
    "./dist",
    `---
title: "test-猫"
permalink: subdir/{{ title | slugify }}/index.html
---
Slugged.
`
  );
  let data = await tmpl.getData();
  t.assert.strictEqual(await tmpl.getOutputPath(data), "./dist/subdir/test-猫/index.html");
});

test("permalink outside of the output directory throws", async (t) => {
  let elev = new Core("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    configPath: false,
    quietMode: true,
    config($config) {
      $config.addTemplate("index.njk", "Hi", { permalink: "../../escaped.html" });
    },
  });
  elev.disableLogger();
  elev.setDryRun(true);

  await t.assert.rejects(elev.write(), (e) => /outside of the output directory/.test(e.cause?.message ?? e.message));
});

test("permalinkBypassOutputDir can write outside of the output directory", async (t) => {
  let elev = new Core("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    configPath: false,
    quietMode: true,
    config($config) {
      $config.addTemplate("index.njk", "Hi", { permalink: "../escaped.html", permalinkBypassOutputDir: true });
    },
  });
  elev.disableLogger();
  elev.setDryRun(true);

  await elev.write();
});
