import { createRequire } from "node:module";
import test from "ava";
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
        t.truthy(this.page.inputPath);
        t.is(dateValue, undefined);
        return "2001-01-01T12:00:00Z";
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.deepEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
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
        t.is(dateValue, "2019-08-31 23:59:56 America/New_York");
        // returns DateTime instance from Luxon
        return DateTime.fromFormat(dateValue, "yyyy-MM-dd hh:mm:ss z");
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.deepEqual(result.data.page.date, new Date(Date.UTC(2019,8,1,3,59,56)));
});

test("Custom date parsing callback (return Date), Issue #867", async (t) => {
  t.plan(3);

  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`);
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function(dateValue) {
        t.truthy(this.page.inputPath);
        t.is(dateValue, undefined);
        return new Date(Date.UTC(2001,0,1,12));
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.deepEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
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
        t.truthy(this.page.inputPath);
        t.true(dateValue instanceof Date);
        return "2001-01-01T12:00:00Z";
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.deepEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
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
        t.truthy(this.page.inputPath);
        t.deepEqual(dateValue, new Date(Date.UTC(2003,0,1,12)));
        // return nothing
      });

      $config.addDateParsing(function (dateValue) {
        t.truthy(this.page.inputPath);
        t.deepEqual(dateValue, new Date(Date.UTC(2003,0,1,12)));
        // return nothing
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.deepEqual(result.data.page.date, new Date(Date.UTC(2003,0,1,12)));
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
        t.truthy(this.page.inputPath);
        return false;
      });
    }
  });

  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.deepEqual(result.data.page.date, new Date(Date.UTC(2003,0,1,12)));
});

test("Custom date parsing callbacks (two, last wins, return string), Issue #867", async (t) => {
  t.plan(5);

  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/", {
    config: $config => {
      $config.addTemplate("test.html", `# Markdown`);
      $config.dataFilterSelectors.add("page.date");

      $config.addDateParsing(function (dateValue) {
        t.truthy(this.page.inputPath);
        t.is(dateValue, undefined);
        return "2010-01-01T12:00:00Z";
      });

      $config.addDateParsing(function (dateValue) {
        t.truthy(this.page.inputPath);
        t.is(dateValue, "2010-01-01T12:00:00Z");
        return "2001-01-01T12:00:00Z";
      });
    }
  });
  elev.disableLogger();

  let [result] = await elev.toJSON();
  t.deepEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
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
  t.deepEqual(result.data.page.date, new Date(Date.UTC(2001,0,1,12)));
});
