import test from "ava";
import fs from "fs";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";

import Eleventy from "../src/Core.js";
import DuplicatePermalinkOutputError from "../src/Errors/DuplicatePermalinkOutputError.js";

import { deleteDirectory } from "./_testHelpers.js";

test("Virtual templates, issue #1612", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# Hello`)
		},
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `<h1>Hello</h1>`);
	t.deepEqual(results[0].rawInput, `# Hello`);
});

test("Virtual templates with front matter, issue #1612", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("./virtual.md", `---
myKey: myValue
---
# {{ myKey }}`)
		},
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `<h1>myValue</h1>`);
	t.deepEqual(results[0].rawInput, `# {{ myKey }}`);
});

test("Virtual templates with supplemental data, issue #1612", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# {{ myKey }}`, { myKey: "myValue" })
		},
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `<h1>myValue</h1>`);
	t.deepEqual(results[0].rawInput, `# {{ myKey }}`);
});

// Supplemental data overrides front matter.
test("Virtual templates with front matter and supplemental data, issue #1612", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `---
myKey1: myValue1
myKey3: myValueFm
---
# {{ myKey1 }}{{ myKey2 }}{{ myKey3 }}`, { myKey2: "myValue2", myKey3: "myValueData" })
		},
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `<h1>myValue1myValue2myValueData</h1>`);
	t.deepEqual(results[0].rawInput, `# {{ myKey1 }}{{ myKey2 }}{{ myKey3 }}`);
});

test("Virtual template conflicts with file on file system, issue #1612", async (t) => {
	let elev = new Eleventy("./test/stubs/stubs-virtual-conflict", "./test/stubs/stubs-virtual-conflict/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# Virtual template`)
		},
	});
	elev.disableLogger();

	await t.throwsAsync(elev.toJSON(), {
		message: `A virtual template had the same path as a file on the file system: "./test/stubs/stubs-virtual-conflict/virtual.md"`
	});
});

test("Virtual templates try to output to the same file, issue #1612", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual-one.md", "", {
				permalink: "/output.html"
			})
			$config.addTemplate("virtual-two.md", "", {
				permalink: "/output.html"
			})
		},
	});
	elev.disableLogger();

	await t.throwsAsync(elev.toJSON(), {
		instanceOf: DuplicatePermalinkOutputError,
	});
});

// Warning: this test writes to the file system
test("Virtual template writes to file system, issue #1612", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual", "./test/stubs-virtual/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# Hello`)
		},
	});
	elev.disableLogger();

	let [,results] = await elev.write();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `<h1>Hello</h1>`);
	t.deepEqual(results[0].rawInput, `# Hello`);
	t.true(fs.existsSync("./test/stubs-virtual/_site/virtual/index.html"));

	deleteDirectory("./test/stubs-virtual/_site/");
});

test("Virtual templates conflict", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# Hello`);
			$config.addTemplate("virtual.md", `# Hello`);
		},
	});

	let e = await t.throwsAsync(async () => {
		await elev.toJSON();
	});

	t.is(e.message, "Virtual template conflict: you can’t add multiple virtual templates that have the same inputPath: virtual.md");
});

// https://github.com/11ty/eleventy-plugin-rss/issues/50
test("RSS virtual templates plugin", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# Hello`, { tag: "posts" })

			$config.addPlugin(feedPlugin, {
				type: "atom", // or "rss", "json"
				outputPath: "/feed.xml",
				collection: {
					name: "posts", // iterate over `collections.posts`
					limit: 10,     // 0 means no limit
				},
			});
		},
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 2);
	let [ feed ] = results.filter(entry => entry.outputPath.endsWith(".xml"));
	t.truthy(feed.content.startsWith(`<?xml version="1.0" encoding="utf-8"?>`));
});

test("Virtual templates as layouts, issue #2307", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.md", `# Hello`, {
				layout: "virtual.html"
			});

			let layoutPath = $config.directories.getLayoutPathRelativeToInputDirectory("virtual.html");
			$config.addTemplate(layoutPath, `<!-- Layout -->{{ content }}`);
		},
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `<!-- Layout --><h1>Hello</h1>`);
	t.deepEqual(results[0].rawInput, `# Hello`);
});

test("11ty.js Virtual Templates (object), issue #3347", async (t) => {
  let templateDefinition = {
    data: () => {
      return { var: 2 };
    },
    render: function(data) {
      return `this is a test ${data.var}.`;
    }
  };

	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.11ty.js", templateDefinition);
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `this is a test 2.`);
	// TODO support rawInput on 11ty.js? Issue #3348
	// t.deepEqual(results[0].rawInput.data, templateDefinition.data);
	// t.deepEqual(results[0].rawInput.render, templateDefinition.render);
});

test("11ty.js Virtual Templates (function), issue #3347", async (t) => {
  let templateDefinition = function(data) {
    return `this is a test ${data.page.url}.`;
  };

	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.11ty.js", templateDefinition);
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `this is a test /virtual/.`);
  // TODO support rawInput on 11ty.js?
	// t.deepEqual(results[0].rawInput, templateDefinition);
});


test("11ty.js class templates with invalid signature, issue #1645", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.11ty.js", class {});
    }
	});
  elev.disableLogger();

  await t.throwsAsync(elev.toJSON(), {
		message: `Invalid class signature for an 11ty.js template: needs a render or data instance property.`
	});
});

test("11ty.js class templates with instance properties (data), issue #1645", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.11ty.js", class { data() { return {} } });
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), ``);
});

test("11ty.js class templates with instance properties (render), issue #1645", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.11ty.js", class { render() { return "Hello!" } });
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `Hello!`);
});

test("11ty.js class templates with instance properties (data and render), issue #1645", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.11ty.js", class {
        data() { return { key: "world" }; }
        render(data) { return `Hello ${data.key}!` }
      });
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `Hello world!`);
});

test("11ty.js class templates with instance properties (data and render arrows), issue #1645", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.11ty.js", class {
        data = () => { return { key: "world" }; }
        render = (data) => { return `Hello ${data.key}!` }
      });
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `Hello world!`);
});

test("11ty.js class templates with instance properties (data and render arrows, new), issue #1645", async (t) => {
	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.11ty.js", new class {
        data = () => { return { key: "world" }; }
        render = (data) => { return `Hello ${data.key}!` }
      });
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `Hello world!`);
});

test("server.js Virtual Templates (object)", async (t) => {
  let templateDefinition = {
    data: () => {
      return { var: 2 };
    },
    render: function(data) {
      return `this is a test ${data.var}.`;
    }
  };

	let elev = new Eleventy("./test/stubs-virtual-nowrite", "./test/stubs-virtual-nowrite/_site", {
		config: function ($config) {
			$config.addTemplate("virtual.server.js", templateDefinition);
    }
	});

	let results = await elev.toJSON();

	t.deepEqual(results.length, 1);
	t.deepEqual(results[0].content.trim(), `this is a test 2.`);
});
