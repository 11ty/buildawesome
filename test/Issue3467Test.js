import test from "ava";
import Eleventy from "../src/Core.js";

test("Empty collections api #3467 (return undefined)", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual", "./test/stubs-virtual/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# Hello`);

      $config.addCollection("brokenCollection", function(collection) {
        // returns nothing
      });
		},
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `<h1>Hello</h1>`);
	t.deepEqual(results[0].rawInput, `# Hello`);
});

test("Empty collections api #3467 (return false)", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual", "./test/stubs-virtual/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# Hello`);

      $config.addCollection("brokenCollection", function(collection) {
        return false;
      });
		},
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `<h1>Hello</h1>`);
	t.deepEqual(results[0].rawInput, `# Hello`);
});

test("Empty collections api #3467 (return empty string)", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual", "./test/stubs-virtual/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# Hello`);

      $config.addCollection("brokenCollection", function(collection) {
        return "";
      });
		},
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `<h1>Hello</h1>`);
	t.deepEqual(results[0].rawInput, `# Hello`);
});
