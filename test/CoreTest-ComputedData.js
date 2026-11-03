import test from "ava";
import BuildAwesome from "../src/Core.js";

test("Using buildawesomeComputed and eleventyComputed (prefers former)", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      // will override
      configApi.addGlobalData("buildawesomeComputed", () => {
        return {
          key1: "value1"
        }
      });

      configApi.addGlobalData("eleventyComputed", () => {
        return {
          key2: "value2"
        }
      });

      configApi.addTemplate("index.njk", "{{ key1 }}", { key1: "original" });
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].content, `value1`);
});

test("Using buildawesomeComputed and eleventyComputed (prefers former, reverse add)", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addGlobalData("eleventyComputed", () => {
        return {
          key2: "value2"
        }
      });

      // will override
      configApi.addGlobalData("buildawesomeComputed", () => {
        return {
          key1: "value1"
        }
      });

      configApi.addTemplate("index.njk", "{{ key1 }}", { key1: "original" });
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].content, `value1`);
});

test("Using buildawesomeComputed.permalink", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addGlobalData("permalink", () => {
        return () => "/rewritten2.html"
      });

      // will override
      configApi.addGlobalData("buildawesomeComputed.permalink", () => {
        return () => "/rewritten1.html"
      });

      configApi.addTemplate("index.njk", "{{ key1 }}", { key1: "original" });
    }
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].content, `original`);
  t.is(results[0].url, `/rewritten1.html`);
});

test("Computed `date` sets `page.date`, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "{{ page.date.toISOString() }}|{{ date }}", {
        eleventyComputed: {
          date: () => "2001-02-03",
        },
      });
    }
  });

  let [result] = await elev.toJSON();
  t.is(result.content, "2001-02-03T00:00:00.000Z|2001-02-03");
});

test("Computed `date` can use other computed data, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "{{ page.date.toISOString() }}", {
        eleventyComputed: {
          date: (data) => `${data.year}-02-03`,
          year: () => "2001",
        },
      });
    }
  });

  let [result] = await elev.toJSON();
  t.is(result.content, "2001-02-03T00:00:00.000Z");
});

test("Computed `date` is available to permalinks, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "", {
        eleventyComputed: {
          date: () => "2001-02-03",
          permalink: "/{{ page.date.getUTCFullYear() }}/",
        },
      });
    }
  });

  let [result] = await elev.toJSON();
  t.is(result.url, "/2001/");
});

test("Computed `date` sorts collections, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("a.njk", "", { date: "2001-01-01", eleventyComputed: { date: () => "2003-01-01" } });
      configApi.addTemplate("b.njk", "", { date: "2002-01-01" });
      configApi.addTemplate("list.njk", "{% for p in collections.all %}{{ p.inputPath }},{% endfor %}", { date: "2000-01-01" });
    }
  });

  let results = await elev.toJSON();
  t.is(results.find((entry) => entry.url === "/list/").content, "./test/stubs-virtual/list.njk,./test/stubs-virtual/b.njk,./test/stubs-virtual/a.njk,");
});

test("Computed `date` passes through custom date parsing, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addDateParsing((dateValue) => dateValue === "launch" ? new Date(Date.UTC(2001, 1, 3)) : undefined);
      configApi.addTemplate("index.njk", "{{ page.date.toISOString() }}", {
        eleventyComputed: {
          date: () => "launch",
        },
      });
    }
  });

  let [result] = await elev.toJSON();
  t.is(result.content, "2001-02-03T00:00:00.000Z");
});

test("Preprocessors see computed data (including `page.date`), Issue #4415", async (t) => {
  let seen;
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addPreprocessor("check", "njk", (data) => {
        seen = { title: data.title, date: data.page.date?.toISOString() };
      });
      configApi.addTemplate("index.njk", "", {
        eleventyComputed: {
          date: () => "2001-02-03",
          title: (data) => `${data.page.filePathStem}!`,
        },
      });
    }
  });

  await elev.toJSON();
  t.deepEqual(seen, { title: "/index!", date: "2001-02-03T00:00:00.000Z" });
});

test("Preprocessors can skip a template using a computed `date`, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addPreprocessor("future", "njk", (data) => {
        if (data.page.date > new Date(Date.UTC(2050, 0, 1))) {
          return false;
        }
      });
      configApi.addTemplate("past.njk", "", { eleventyComputed: { date: () => "2001-02-03" } });
      configApi.addTemplate("future.njk", "", { eleventyComputed: { date: () => "2099-02-03" } });
    }
  });

  let results = await elev.toJSON();
  t.deepEqual(results.map((entry) => entry.url), ["/past/"]);
});

test("Computed data reading `page.rawInput` waits until after preprocessors", async (t) => {
  let seen;
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addPreprocessor("check", "njk", (data, content) => {
        seen = data.length;
        return content + "!";
      });
      configApi.addTemplate("index.njk", "{{ length }}", {
        eleventyComputed: {
          length: (data) => data.page.rawInput.length,
        },
      });
    }
  });

  let [result] = await elev.toJSON();
  t.is(seen, undefined);
  // Length of the preprocessed `{{ length }}!`
  t.is(result.content, "13!");
});

test("Paginated templates compute shared values once and per-page values per page", async (t) => {
  let runs = { shared: 0, perPage: 0 };
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "{{ shared }}|{{ perPage }}", {
        items: ["a", "b", "c"],
        pagination: { data: "items", size: 1, alias: "item" },
        permalink: "/{{ item }}/",
        eleventyComputed: {
          shared: () => `shared${++runs.shared}`,
          perPage: (data) => {
            runs.perPage++;
            return `${data.item}-${data.shared}`;
          },
        },
      });
    }
  });

  let results = await elev.toJSON();
  t.deepEqual(results.map((entry) => entry.content).sort(), ["shared1|a-shared1", "shared1|b-shared1", "shared1|c-shared1"]);
  t.is(runs.shared, 1);
});

test("Paginate over computed data, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "{{ locale }}", {
        pagination: { data: "supportedLocales", size: 1, alias: "locale" },
        permalink: "/{{ locale }}/",
        eleventyComputed: {
          supportedLocales: () => ["en", "fr"],
        },
      });
    }
  });

  let results = await elev.toJSON();
  t.deepEqual(results.map((entry) => entry.url).sort(), ["/en/", "/fr/"]);
});

test("Computed `date` per paginated page, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "{{ page.date.toISOString() }}", {
        items: ["2001-01-01", "2002-02-02"],
        pagination: { data: "items", size: 1, alias: "item" },
        permalink: "/{{ item }}/",
        eleventyComputed: {
          date: (data) => data.item,
        },
      });
    }
  });

  let results = await elev.toJSON();
  t.deepEqual(results.map((entry) => entry.content).sort(), ["2001-01-01T00:00:00.000Z", "2002-02-02T00:00:00.000Z"]);
});

test("Computed `eleventyImport` adds collection dependencies, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("post.njk", "", { tags: ["posts"] });
      configApi.addTemplate("computed.njk", "", {
        eleventyComputed: {
          eleventyImport: () => ({ collections: ["posts"] }),
        },
      });
      configApi.addTemplate("front-matter.njk", "", { eleventyImport: { collections: ["posts"] } });
    }
  });

  await elev.toJSON();
  t.deepEqual(Array.from(elev.eleventyConfig.usesGraph.getTemplatesThatConsumeCollections(["posts"])).sort(), [
    "test/stubs-virtual/computed.njk",
    "test/stubs-virtual/front-matter.njk",
  ]);
});

function getPaginationError(e) {
  while (e && e.name !== "PaginationError") {
    e = e.originalError ?? e.cause;
  }
  return e;
}

async function getOutputLocations(templates, config) {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      config?.(configApi);
      for (let [name, data] of Object.entries(templates)) {
        configApi.addTemplate(name, "", data);
      }
    }
  });

  let results = await elev.toJSON();
  return Object.fromEntries(results.map((entry) => [entry.inputPath.split("/").pop(), [entry.url, entry.outputPath]]));
}

test("Computed `dynamicPermalink`, Issue #4415", async (t) => {
  let locations = await getOutputLocations({
    "computed.njk": { x: "hi", permalink: "/computed-{{ x }}/", eleventyComputed: { dynamicPermalink: () => false } },
    "front-matter.njk": { x: "hi", permalink: "/front-matter-{{ x }}/", dynamicPermalink: false },
  });

  t.deepEqual(locations["computed.njk"], ["/computed-{{ x }}/", "./_site/computed-{{ x }}/index.html"]);
  t.deepEqual(locations["front-matter.njk"], ["/front-matter-{{ x }}/", "./_site/front-matter-{{ x }}/index.html"]);
});

test("Computed `dynamicPermalink` using other computed data, Issue #4415", async (t) => {
  let locations = await getOutputLocations({
    "index.njk": {
      x: "hi",
      permalink: "/{{ x }}/",
      eleventyComputed: { literal: () => true, dynamicPermalink: (data) => !data.literal },
    },
  });

  t.deepEqual(locations["index.njk"], ["/{{ x }}/", "./_site/{{ x }}/index.html"]);
});

test("Computed `permalinkBypassOutputDir`, Issue #4415", async (t) => {
  let locations = await getOutputLocations({
    "computed.njk": { permalink: "computed.html", eleventyComputed: { permalinkBypassOutputDir: () => true } },
    "front-matter.njk": { permalink: "front-matter.html", permalinkBypassOutputDir: true },
    "neither.njk": { permalink: "neither.html" },
  });

  t.deepEqual(locations["computed.njk"], ["/computed.html", "./computed.html"]);
  t.deepEqual(locations["front-matter.njk"], ["/front-matter.html", "./front-matter.html"]);
  t.deepEqual(locations["neither.njk"], ["/neither.html", "./_site/neither.html"]);
});

test("`permalinkBypassOutputDir` from the data cascade (not only front matter)", async (t) => {
  let locations = await getOutputLocations({
    "index.njk": { permalink: "global.html" },
  }, (configApi) => {
    configApi.addGlobalData("permalinkBypassOutputDir", true);
  });

  t.deepEqual(locations["index.njk"], ["/global.html", "./global.html"]);
});

test("Computed `permalinkBypassOutputDir` with pagination, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "", {
        items: ["a", "b"],
        pagination: { data: "items", size: 1, alias: "item" },
        permalink: "{{ item }}.html",
        eleventyComputed: { permalinkBypassOutputDir: () => true },
      });
    }
  });
  let results = await elev.toJSON();
  t.deepEqual(results.map((entry) => entry.outputPath).sort(), ["./a.html", "./b.html"]);
});

test("Computed `pagination`, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "{{ item }}:{{ label }}", {
        items: ["a", "b", "c", "d"],
        perPage: 2,
        permalink: "/page-{{ pagination.pageNumber }}/",
        eleventyComputed: {
          pagination: (data) => ({ data: "items", size: data.perPage, alias: "item" }),
          label: (data) => data.item.join("+"),
        },
      });
    }
  });

  let results = await elev.toJSON();
  t.deepEqual(results.map((entry) => [entry.url, entry.content]).sort(), [
    ["/page-0/", "a,b:a+b"],
    ["/page-1/", "c,d:c+d"],
  ]);
});

test("Computed `pagination` (object form) overrides front matter pagination, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "{{ pagination.items }}", {
        items: ["a", "b", "c", "d"],
        perPage: 1,
        pagination: { data: "items", size: 4 },
        eleventyComputed: {
          pagination: { size: (data) => data.perPage * 2 },
        },
      });
    }
  });

  let results = await elev.toJSON();
  t.deepEqual(results.map((entry) => entry.content).sort(), ["a,b", "c,d"]);
});

test("Computed `pagination` over a collection, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("post1.njk", "", { tags: ["posts"] });
      configApi.addTemplate("post2.njk", "", { tags: ["posts"] });
      configApi.addTemplate("index.njk", "{{ post.inputPath }}", {
        permalink: "/list-{{ pagination.pageNumber }}/",
        eleventyComputed: {
          pagination: () => ({ data: "collections.posts", size: 1, alias: "post" }),
        },
      });
    }
  });

  let results = await elev.toJSON();
  t.deepEqual(results.filter((entry) => entry.url.startsWith("/list-")).map((entry) => entry.content).sort(), [
    "./test/stubs-virtual/post1.njk",
    "./test/stubs-virtual/post2.njk",
  ]);
});

test("Computed `pagination` that reads collections throws, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("post.njk", "", { tags: ["posts"] });
      configApi.addTemplate("index.njk", "", {
        eleventyComputed: {
          pagination: (data) => ({ data: "collections.posts", size: data.collections.posts.length }),
        },
      });
    }
  });
  elev.disableLogger();

  let e = getPaginationError(await t.throwsAsync(() => elev.toJSON()));
  t.is(e.message, "Computed `pagination` (./test/stubs-virtual/index.njk) reads `collections`, which isn’t available until after pagination.");
});

test("Computed `pagination` that reads per-page data throws, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "", {
        items: ["a"],
        eleventyComputed: {
          pagination: { data: "items", size: (data) => (data.page.url ? 1 : 2) },
        },
      });
    }
  });
  elev.disableLogger();

  let e = getPaginationError(await t.throwsAsync(() => elev.toJSON()));
  t.is(e.message, "Computed `pagination.size` (./test/stubs-virtual/index.njk) reads `page.url`, which isn’t available until after pagination.");
});

test("Paginating over computed data that needs collections throws, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("post.njk", "", { tags: ["posts"] });
      configApi.addTemplate("index.njk", "", {
        // Without the error, this static value would be paginated silently
        postsCopy: ["static"],
        pagination: { data: "postsCopy", size: 1 },
        eleventyComputed: { postsCopy: (data) => data.collections.posts },
      });
    }
  });
  elev.disableLogger();

  let e = getPaginationError(await t.throwsAsync(() => elev.toJSON()));
  t.is(e.message, "Pagination data `postsCopy` can’t use computed data `postsCopy` (./test/stubs-virtual/index.njk) because it reads `collections`, which isn’t available until after pagination.");
});

test("Paginating over computed data that depends on per-page data throws, Issue #4415", async (t) => {
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.njk", "", {
        pagination: { data: "list", size: 1 },
        eleventyComputed: {
          url: (data) => data.page.url,
          list: (data) => [data.url],
        },
      });
    }
  });
  elev.disableLogger();

  let e = getPaginationError(await t.throwsAsync(() => elev.toJSON()));
  t.is(e.message, "Pagination data `list` can’t use computed data `list` (./test/stubs-virtual/index.njk) because it reads `page.url`, which isn’t available until after pagination.");
});

test("Conditional computed `pagination` (falsy means no pagination), Issue #4415", async (t) => {
  let pagination = (data) => (data.paginate ? { data: "items", size: 1, alias: "item" } : undefined);
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("paged.njk", "{{ item }}", {
        paginate: true,
        items: ["a", "b"],
        permalink: "/paged-{{ item }}/",
        eleventyComputed: { pagination },
      });
      configApi.addTemplate("single.njk", "single", {
        paginate: false,
        items: ["a", "b"],
        eleventyComputed: { pagination },
      });
    }
  });

  let results = await elev.toJSON();
  t.deepEqual(results.map((entry) => [entry.url, entry.content]).sort(), [
    ["/paged-a/", "a"],
    ["/paged-b/", "b"],
    ["/single/", "single"],
  ]);
});

for (let value of [undefined, null, false]) {
  test(`\`pagination: ${value}\` in front matter means no pagination`, async (t) => {
    let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
      config: configApi => {
        configApi.addTemplate("index.njk", "hi", { pagination: value });
      }
    });

    let results = await elev.toJSON();
    t.deepEqual(results.map((entry) => entry.url), ["/"]);
  });
}

test("Computed data renders the permalink once for `page.url` and `page.outputPath`", async (t) => {
  let renders = 0;
  let elev = new BuildAwesome("./test/stubs-virtual/", undefined, {
    config: configApi => {
      configApi.addTemplate("index.11ty.js", "", {
        permalink: () => {
          renders++;
          return "/custom/";
        },
        eleventyComputed: { other: () => true },
      });
    }
  });

  let [result] = await elev.toJSON();
  t.is(result.url, "/custom/");
  t.is(result.outputPath, "./_site/custom/index.html");
  t.is(renders, 1);
});
