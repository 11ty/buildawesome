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
