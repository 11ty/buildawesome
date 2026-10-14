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
