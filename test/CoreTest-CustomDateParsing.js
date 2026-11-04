import { createRequire } from "node:module";
import test from "node:test";
import { DateTime } from "luxon";
import Eleventy from "../src/Core.js";

const require = createRequire(import.meta.url);
const HAS_TEMPORAL = typeof globalThis.Temporal !== "undefined";

test("Custom date parsing callback (return string), Issue #867", async (t) => {
  t.plan(3);

  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`);
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function(dateValue) {
        t.assert.ok(this.page.inputPath);
        t.assert.strictEqual(dateValue, undefined);
        return "2001-01-01T12:00:00Z";
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
});

test("Custom date parsing callback (input a non-YAML date format), Issue #867", async (t) => {
  t.plan(2);

  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `---
date: 2019-08-31 23:59:56 America/New_York
---
# Markdown`);
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function(dateValue) {
        t.assert.strictEqual(dateValue, "2019-08-31 23:59:56 America/New_York");
        // returns DateTime instance from Luxon
        return DateTime.fromFormat(dateValue, "yyyy-MM-dd hh:mm:ss z");
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2019,8,1,3,59,56)));
});

test("Custom date parsing callback (return Date), Issue #867", async (t) => {
  t.plan(3);

  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`);
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function(dateValue) {
        t.assert.ok(this.page.inputPath);
        t.assert.strictEqual(dateValue, undefined);
        return new Date(Date.UTC(2001,0,1,12));
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
});

test("Custom date parsing callback (using date from data cascade, return string), Issue #867", async (t) => {
  t.plan(3);

  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`, {
        date: new Date(Date.UTC(2002, 0, 1, 12))
      });
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function (dateValue) {
        t.assert.ok(this.page.inputPath);
        t.assert.strictEqual(dateValue instanceof Date, true);
        return "2001-01-01T12:00:00Z";
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
});

test("Custom date parsing callback (two, return undefined/falsy), Issue #867", async (t) => {
  t.plan(5);

  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`, {
        date: new Date(Date.UTC(2003, 0, 1, 12))
      });
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function (dateValue) {
        t.assert.ok(this.page.inputPath);
        t.assert.deepStrictEqual(dateValue, new Date(Date.UTC(2003,0,1,12)));
        // return nothing
      });

      $config.addDateParsing(function (dateValue) {
        t.assert.ok(this.page.inputPath);
        t.assert.deepStrictEqual(dateValue, new Date(Date.UTC(2003,0,1,12)));
        // return nothing
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2003,0,1,12)));
});

test("Custom date parsing callback (return explicit false), Issue #867", async (t) => {
  t.plan(2);

  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`, {
        date: new Date(Date.UTC(2003, 0, 1, 12))
      });
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function (dateValue) {
        t.assert.ok(this.page.inputPath);
        return false;
      });
    }
  });

  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2003,0,1,12)));
});

test("Custom date parsing callbacks (two, last wins, return string), Issue #867", async (t) => {
  t.plan(5);

  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`);
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function (dateValue) {
        t.assert.ok(this.page.inputPath);
        t.assert.strictEqual(dateValue, undefined);
        return "2010-01-01T12:00:00Z";
      });

      $config.addDateParsing(function (dateValue) {
        t.assert.ok(this.page.inputPath);
        t.assert.strictEqual(dateValue, "2010-01-01T12:00:00Z");
        return "2001-01-01T12:00:00Z";
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
});

// https://github.com/11ty/eleventy/issues/3674
test("instanceof DateTime issue, Issue #3674", async (t) => {
  const { DateTime } = require("luxon");

  // this test *requires* a non-virtual template to repro
  let elev = new Eleventy("./test/stubs/index.html", undefined, {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`);
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function (dateValue) {
        return DateTime.fromISO("2001-01-01T12:00:00Z");
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
});

test("Custom date parsing callback with computed `date` (return DateTime), Issue #4415", async (t) => {
  let seen = [];
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`, {
        eleventyComputed: {
          date: () => "2019-08-31 23:59:56 America/New_York",
        },
      });
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function(dateValue) {
        seen.push(dateValue);
        if (typeof dateValue === "string") {
          return DateTime.fromFormat(dateValue, "yyyy-MM-dd hh:mm:ss z");
        }
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  // Runs once, with the computed value only
  t.assert.deepStrictEqual(seen, ["2019-08-31 23:59:56 America/New_York"]);
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2019,8,1,3,59,56)));
});

test("Custom date parsing callback with computed `date` (project time zone), Issue #4415", async (t) => {
  let seen = [];
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`, {
        eleventyComputed: {
          date: (data) => `${data.year}-08-31T23:59:56`,
          year: () => "2019",
        },
      });
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function(dateValue) {
        seen.push([dateValue, this.page.inputPath]);
        let localDate;
        if(dateValue instanceof Date) {
          localDate = DateTime.fromJSDate(dateValue, { zone: "utc" }).setZone("America/Chicago", { keepLocalTime: true });
        } else if(typeof dateValue === "string") {
          localDate = DateTime.fromISO(dateValue, { zone: "America/Chicago" });
        }
        if (localDate?.isValid === false) {
          throw new Error(`Invalid \`date\` value (${dateValue}) is invalid for ${this.page.inputPath}: ${localDate.invalidReason}`);
        }
        return localDate;
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(seen, [["2019-08-31T23:59:56", "./test/stubs-virtual/test.html"]]);
  t.assert.deepStrictEqual(result.data.page.date, new Date(Date.UTC(2019,8,1,4,59,56)));
});

test("Custom date parsing callback runs once for a computed `date` shared by paginated pages, Issue #4415", async (t) => {
  let seen = [];
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.njk", `{{ page.date.toISOString() }}`, {
        items: ["a", "b", "c"],
        pagination: { data: "items", size: 1, alias: "item" },
        permalink: "/{{ item }}/",
        eleventyComputed: {
          date: () => "2001-01-01T12:00:00Z",
        },
      });

      $config.addDateParsing(function(dateValue) {
        seen.push(dateValue);
      });
    }
  });
  elev.disableLogger();

  let results = await elev.toJSON();
  t.assert.deepStrictEqual(seen, ["2001-01-01T12:00:00Z"]);
  t.assert.deepStrictEqual(results.map((entry) => entry.content), Array(3).fill("2001-01-01T12:00:00.000Z"));
});

test("setDateTimeZone: date-only string is midnight in project time zone, Issue #3668", { skip: !HAS_TEMPORAL }, async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.setDateTimeZone("America/Chicago");
      $config.addTemplate("test.html", `---
date: "2025-03-01"
---
# Markdown`);
      $config.dataFilterSelectors.add("page.date");
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date("2025-03-01T06:00:00Z"));
});

test("setDateTimeZone: datetime string without offset (DST), Issue #3668", { skip: !HAS_TEMPORAL }, async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.setDateTimeZone("Europe/Berlin");
      $config.addTemplate("test.html", `---
date: "2025-07-01T10:30:00"
---
# Markdown`);
      $config.dataFilterSelectors.add("page.date");
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date("2025-07-01T08:30:00Z"));
});

test("setDateTimeZone: explicit offset is unchanged, Issue #3668", { skip: !HAS_TEMPORAL }, async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.setDateTimeZone("America/Chicago");
      $config.addTemplate("test.html", `---
date: "2025-03-01T10:00:00Z"
---
# Markdown`);
      $config.dataFilterSelectors.add("page.date");
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date("2025-03-01T10:00:00Z"));
});

test("setDateTimeZone: file name date, Issue #3668", { skip: !HAS_TEMPORAL }, async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.setDateTimeZone("Asia/Tokyo");
      $config.addTemplate("2025-03-01-post.html", `# Markdown`);
      $config.dataFilterSelectors.add("page.date");
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.assert.deepStrictEqual(result.data.page.date, new Date("2025-02-28T15:00:00Z"));
});

test("setDateTimeZone: invalid time zone throws, Issue #3668", { skip: !HAS_TEMPORAL }, async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.setDateTimeZone("Not/AZone");
    }
  });
  elev.disableLogger();

  await t.assert.rejects(elev.toJSON(), /Invalid time zone/);
});

for (let [label, options] of [["Temporal", undefined], ["Luxon", { adapter: (parts, zone) => DateTime.fromObject(parts, { zone }).toJSDate() }]]) {
  test(`setDateTimeZone (${label} adapter): date-only, datetime, DST gap, file name, Issue #3668`, { skip: !options && !HAS_TEMPORAL }, async (t) => {
    let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
      config: $config => {
        $config.setDateTimeZone("America/Chicago", options);
        $config.addTemplate("date-only.html", `---\ndate: "2025-03-01"\n---\n`);
        $config.addTemplate("datetime.html", `---\ndate: "2025-07-01T10:30:00"\n---\n`);
        $config.addTemplate("dst-gap.html", `---\ndate: "2025-03-09T02:30:00"\n---\n`);
        $config.addTemplate("offset.html", `---\ndate: "2025-03-01T10:00:00Z"\n---\n`);
        $config.addTemplate("2025-12-01-post.html", ``);
        $config.dataFilterSelectors.add("page.date");
      }
    });
    elev.disableLogger();

    let results = await elev.toJSON();
    let dates = Object.fromEntries(results.map(r => [r.inputPath.split("/").pop(), r.data.page.date.toISOString()]));
    t.assert.deepStrictEqual(dates, {
      "date-only.html": "2025-03-01T06:00:00.000Z",
      "datetime.html": "2025-07-01T15:30:00.000Z",
      "dst-gap.html": "2025-03-09T08:30:00.000Z",
      "offset.html": "2025-03-01T10:00:00.000Z",
      "2025-12-01-post.html": "2025-12-01T06:00:00.000Z",
    });
  });
}

test("setDateTimeZone (Luxon adapter): invalid time zone throws, Issue #3668", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.setDateTimeZone("Not/AZone", { adapter: (parts, zone) => DateTime.fromObject(parts, { zone }).toJSDate() });
    }
  });
  elev.disableLogger();

  await t.assert.rejects(elev.toJSON(), /Invalid time zone/);
});

test("setDateTimeZone: non-function adapter throws, Issue #3668", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.setDateTimeZone("America/Chicago", { adapter: "luxon" });
    }
  });
  elev.disableLogger();

  await t.assert.rejects(elev.toJSON(), /`adapter` option to be a function/);
});

test("setDateTimeZone: missing Temporal without an adapter throws, Issue #3668", { skip: HAS_TEMPORAL }, async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.setDateTimeZone("America/Chicago");
    }
  });
  elev.disableLogger();

  await t.assert.rejects(elev.toJSON(), /requires a JavaScript runtime with Temporal support/);
});
