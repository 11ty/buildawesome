import test from "ava";
import Eleventy from "../src/Core.js";

// Directory data files can’t be virtual, so only the templates are.
async function getResults(templates) {
  let elev = new Eleventy("./test/stubs-2634/", undefined, {
    config: (eleventyConfig) => {
      for (let [inputPath, content, data] of templates) {
        eleventyConfig.addTemplate(inputPath, content, data);
      }
    },
  });
  let json = await elev.toJSON();
  return Object.fromEntries(json.map((entry) => [entry.inputPath, entry]));
}

function getUrls(results) {
  return Object.fromEntries(Object.entries(results).map(([inputPath, entry]) => [inputPath, entry.url]));
}

test("#2634: Directory data computed permalink overrides template front matter permalink", async (t) => {
  let results = await getResults([
    ["computed/a.md", "A", { title: "Hello World" }],
    ["computed/b.md", "B", { title: "Other", permalink: "/explicit/" }],
  ]);

  t.deepEqual(getUrls(results), {
    "./test/stubs-2634/computed/a.md": "/computed/hello-world/",
    "./test/stubs-2634/computed/b.md": "/computed/other/",
  });
});

test("#2634: Directory data computed property overrides template front matter (not specific to permalink)", async (t) => {
  let results = await getResults([["subtitle/index.md", "{{ subtitle }}", { subtitle: "Front Matter" }]]);

  t.is(results["./test/stubs-2634/subtitle/index.md"].content.trim(), "<p>Computed</p>");
});

test("#2634: Workaround, plain permalink in directory data is overridden by template front matter", async (t) => {
  let results = await getResults([
    ["plain/a.md", "A", { title: "Hello World" }],
    ["plain/b.md", "B", { title: "Other", permalink: "/explicit/" }],
  ]);

  t.deepEqual(getUrls(results), {
    "./test/stubs-2634/plain/a.md": "/plain/hello-world/",
    "./test/stubs-2634/plain/b.md": "/explicit/",
  });
});

test("#2634: Workaround, computed permalink falls back to data.permalink", async (t) => {
  let results = await getResults([
    ["fallback/a.md", "A", { title: "Hello World" }],
    ["fallback/b.md", "B", { title: "Other", permalink: "/explicit/" }],
  ]);

  t.deepEqual(getUrls(results), {
    "./test/stubs-2634/fallback/a.md": "/fallback/hello-world/",
    "./test/stubs-2634/fallback/b.md": "/explicit/",
  });
});
