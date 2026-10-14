import test from "ava";
import Eleventy from "../src/Core.js";

test("Paired shortcodes in macros #2261 #1749", async (t) => {
	let elev = new Eleventy({
		input: "./test/stubs-2261/",
		configPath: "./test/stubs-2261/eleventy.config.js",
	});

	let results = await elev.toJSON();
	t.is(results.length, 1);
	t.is(results[0].content.trim(), `<div>HelloHello Manuel</div>`);
});

test("Async -> Sync crossover shortcodes in Nunjucks #4305 #2261", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual", "./test/stubs-virtual/_site", {
		config: function ($config) {
      $config.addPairedShortcode("sync", (content) => {
        return "abc" + content;
      })
      $config.addPairedShortcode("async", async (content) => {
        return new Promise(res => {
          setTimeout(() => {
            res(content.toUpperCase() + "xyz")
          });
        })
      })
			$config.addTemplate("index.njk", "{% async %}before{% sync %}test{% endsync %}after{% endasync %}");
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `BEFOREABCTESTAFTERxyz`);
});

test("Sync -> Async crossover shortcodes in Nunjucks #4305 #2261", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual", "./test/stubs-virtual/_site", {
		config: function ($config) {
      $config.addPairedShortcode("sync", (content) => {
        return "abc" + content;
      })
      $config.addPairedShortcode("async", async (content) => {
        return new Promise(res => {
          setTimeout(() => {
            res(content.toUpperCase() + "xyz")
          });
        })
      });

			$config.addTemplate("index.njk", "{% sync %}before{% async %}test{% endasync %}after{% endsync %}");
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `abcbeforeTESTxyzafter`);
});

test("Sync -> psuedo-Async (returns promise) crossover shortcodes in Nunjucks #4305 #2261", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual", "./test/stubs-virtual/_site", {
		config: function ($config) {
      $config.addPairedShortcode("sync", (content) => {
        return "abc" + content;
      })
      $config.addPairedShortcode("pseudoasync", (content) => {
        return new Promise(res => {
          setTimeout(() => {
            res(content.toUpperCase() + "xyz")
          });
        })
      });
      $config.addPairedShortcode("async", async (content) => {
        return new Promise(res => {
          setTimeout(() => {
            res(content.toUpperCase() + "xyz")
          });
        })
      });

			$config.addTemplate("index.njk", "{% sync %}before{% pseudoasync %}test{% endpseudoasync %}after{% endsync %}");
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `abcbeforeTESTxyzafter`);
});
