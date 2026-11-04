import { createRequire } from "node:module";
import test from "node:test";
import { DateTime } from "luxon";
import Eleventy from "../src/Core.js";

const require = createRequire(import.meta.url);

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
