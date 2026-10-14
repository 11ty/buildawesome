import test from "ava";

import { IdAttributePlugin } from "../src/Plugins/IdAttributePlugin.js";
import Eleventy from "../src/Core.js";

test("Using the IdAttribute plugin #3356", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.njk", `<h1>This is a heading</h1><h2 id="already">This is another heading</h2><h2>This is another heading</h2><h3>This is another heading</h3>`, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content, `<h1 id="this-is-a-heading">This is a heading</h1><h2 id="already">This is another heading</h2><h2 id="this-is-another-heading">This is another heading</h2><h3 id="this-is-another-heading-2">This is another heading</h3>`);
});

test("Using the IdAttribute plugin, eleventy:ignore attribute #3356", async (t) => {
  let elev = new Eleventy({
    input: "./test/stubs-3356/",
    // configPath: false,
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.njk", `<h1>This is a heading</h1><h2 id="already">This is another heading</h2><h2>This is another heading</h2><h3>This is another <span eleventy:id-ignore>heading</span></h3>`, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content, `<h1 id="this-is-a-heading">This is a heading</h1><h2 id="already">This is another heading</h2><h2 id="this-is-another-heading">This is another heading</h2><h3 id="this-is-another">This is another <span>heading</span></h3>`);
});

test("Using the IdAttribute plugin, buildawesome:ignore attribute #3356", async (t) => {
  let elev = new Eleventy({
    input: "./test/stubs-3356/",
    // configPath: false,
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.njk", `<h1>This is a heading</h1><h2 id="already">This is another heading</h2><h2>This is another heading</h2><h3>This is another <span buildawesome:id-ignore>heading</span></h3>`, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content, `<h1 id="this-is-a-heading">This is a heading</h1><h2 id="already">This is another heading</h2><h2 id="this-is-another-heading">This is another heading</h2><h3 id="this-is-another">This is another <span>heading</span></h3>`);
});

test("Using the IdAttribute plugin with escaped quoted text", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.md", `# This is a \`"heading"\``, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content.trim(), `<h1 id="this-is-a-heading">This is a <code>&quot;heading&quot;</code></h1>`);
});

test("Issue #3424, id attribute conflicts (id attribute supplied first)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.html", `<div id="testing"></div><h1>Testing</h1>`, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content.trim(), `<div id="testing"></div><h1 id="testing-2">Testing</h1>`);
});

test("Issue #3424, id attribute conflicts (id attribute supplied last)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.html", `<h1>Testing</h1><div id="testing"></div>`, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content.trim(), `<h1 id="testing-2">Testing</h1><div id="testing"></div>`);
});

test("Issue #3424, id attribute conflicts (hard coded id conflicts)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.html", `<h1>Testing</h1><h1 id="testing">Testing</h1>`, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content.trim(), `<h1 id="testing-2">Testing</h1><h1 id="testing">Testing</h1>`);
});

test("Issue #3424, id attribute conflicts (three deep, hard coded id conflicts)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.html", `<h1>Testing</h1><h1>Testing</h1><h1 id="testing">Testing</h1>`, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content.trim(), `<h1 id="testing-3">Testing</h1><h1 id="testing-2">Testing</h1><h1 id="testing">Testing</h1>`);
});

test("Issue #3424, id attribute conflicts (four deep, hard coded id conflicts)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.html", `<h1>Testing</h1><h1>Testing</h1><h1>Testing</h1><h1 id="testing">Testing</h1>`, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content.trim(), `<h1 id="testing-4">Testing</h1><h1 id="testing-2">Testing</h1><h1 id="testing-3">Testing</h1><h1 id="testing">Testing</h1>`);
});

test("Issue #3424, id attribute conflicts (five deep, hard coded id conflicts)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.html", `<h1>Testing</h1><h1>Testing</h1><h1>Testing</h1><h1>Testing</h1><h1 id="testing">Testing</h1>`, {});
    },
  });

  let results = await elev.toJSON();
	t.is(results[0].content.trim(), `<h1 id="testing-5">Testing</h1><h1 id="testing-2">Testing</h1><h1 id="testing-3">Testing</h1><h1 id="testing-4">Testing</h1><h1 id="testing">Testing</h1>`);
});

test("Issue #3424, id attribute conflicts (two hard coded id conflicts)", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin);

      $config.addTemplate("test.html", `<h1 id="testing">Testing</h1><h1 id="testing">Testing</h1>`, {});
    },
  });
  elev.disableLogger();

  let e = await t.throwsAsync(() => elev.toJSON());
  t.is(e.originalError.originalError.toString(), `Error: You have more than one HTML \`id\` attribute using the same value (id="testing") in your template (./test/stubs-virtual/test.html). You can disable this error in the IdAttribute plugin with the \`checkDuplicates: false\` option.`);
});

test("Issue #3424, filter callback skips", async (t) => {
  let elev = new Eleventy("./test/stubs-virtual/", "./test/stubs-virtual/_site", {
    config: function ($config) {
      $config.addPlugin(IdAttributePlugin, {
        filter: function({ page }) {
          if(page.inputPath.endsWith("test-skipped.html")) {
            return false;
          }
          return true;
        }
      });

      $config.addTemplate("test.html", `<h1>Testing</h1><h1 id="testing">Testing</h1>`, {});
      $config.addTemplate("test-skipped.html", `<h1 id="testing">Testing</h1><h1 id="testing">Testing</h1>`, {});
    },
  });
  elev.disableLogger();

  let results = await elev.toJSON();
	t.is(results[0].content.trim(), `<h1 id="testing-2">Testing</h1><h1 id="testing">Testing</h1>`);
	t.is(results[1].content.trim(), `<h1 id="testing">Testing</h1><h1 id="testing">Testing</h1>`);
});
