import test from "ava";
import fs from "node:fs";
import { TemplatePath } from "@11ty/eleventy-utils";
import { globSync } from "tinyglobby";

import { TransformPlugin as InputPathToUrlTransformPlugin } from "../src/Plugins/InputPathToUrl.js";
import { default as HtmlBasePlugin } from "../src/Plugins/HtmlBasePlugin.js";
import Eleventy from "../src/Core.js";
import { deleteDirectory } from "./_testHelpers.js";

test.after.always("Directory cleanup", () => {
  let dirs = globSync("./test/stubs-autocopy/_site*", {
    onlyDirectories: true,
    expandDirectories: false,
  });

	for(let dir of dirs) {
		deleteDirectory(dir);
	}
})

test("Basic usage", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site-basica", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			$config.addPassthroughCopy("**/*.png", {
				mode: "html-relative"
			})

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, {
					map: {
						"/test/possum.png": TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.png")
					}
				})
			});

			$config.addTemplate("test.njk", `<img src="possum.png">`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 1);
	t.is(templates.length, 1);

	t.deepEqual(templates[0], {
		inputPath: './test/stubs-autocopy/test.njk',
		outputPath: './test/stubs-autocopy/_site-basica/test/index.html',
		url: '/test/',
		content: '<img src="possum.png">',
		rawInput: '<img src="possum.png">'
	});

	t.deepEqual(copy[0], {
		count: 1,
		map: {
			[TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.png")]: TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/_site-basica/test/possum.png"),
		}
	});

	t.is(fs.existsSync("test/stubs-autocopy/_site-basica/test/possum.png"), true);
	t.is(fs.existsSync("test/stubs-autocopy/_site-basica/test/index.html"), true);
});

test("More complex image path (parent dir)", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site-basicb", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			$config.addPassthroughCopy("**/*.png", {
				mode: "html-relative"
			})

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, {
					map: {
						"/stubs-img-transform/possum.png": TemplatePath.normalizeOperatingSystemFilePath("test/stubs-img-transform/possum.png")
					}
				})
			});

			$config.addTemplate("test.njk", `<img src="../stubs-img-transform/possum.png">`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 1);
	t.is(templates.length, 1);

	t.deepEqual(templates[0], {
		inputPath: './test/stubs-autocopy/test.njk',
		outputPath: './test/stubs-autocopy/_site-basicb/test/index.html',
		url: '/test/',
		content: '<img src="../stubs-img-transform/possum.png">',
		rawInput: '<img src="../stubs-img-transform/possum.png">'
	});

	t.deepEqual(copy[0], {
		count: 1,
		map: {
			// test/stubs-autocopy/test.njk => "../stubs-img-transform/possum.png"
			[TemplatePath.normalizeOperatingSystemFilePath("test/stubs-img-transform/possum.png")]: TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/_site-basicb/stubs-img-transform/possum.png"),
		}
	});

	t.is(fs.existsSync("test/stubs-autocopy/_site-basicb/stubs-img-transform/possum.png"), true);
	t.is(fs.existsSync("test/stubs-autocopy/_site-basicb/test/index.html"), true);
});

test("No matches", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site2", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			$config.addPassthroughCopy("**/*.jpeg", {
				mode: "html-relative"
			})

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, { map: {} })
			});

			$config.addTemplate("test.njk", `<img src="lol.lol">`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 0);
	t.is(templates.length, 1);

	t.is(fs.existsSync("test/stubs-autocopy/_site2/test/lol.lol"), false);
	t.is(fs.existsSync("test/stubs-autocopy/_site2/test/index.html"), true);
});

test("Match but does not exist (throws error)", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site3", {
		configPath: false,
		config: function ($config) {
			$config.addPassthroughCopy("**/*.png", {
				mode: "html-relative"
			});

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, { map: {} })
			});

			$config.addTemplate("test.njk", `<img src="missing.png">`)
		},
	});

	elev.disableLogger();

	await t.throwsAsync(async () => {
		await elev.write();
	}, {
		message: `Having trouble writing to "./test/stubs-autocopy/_site3/test/index.html" from "./test/stubs-autocopy/test.njk"`
	});

	t.is(fs.existsSync("test/stubs-autocopy/_site3/test/index.html"), false);
});

test("Match but does not exist (no error, using `failOnError: false`)", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site4", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			$config.addPassthroughCopy("**/*.png", {
				mode: "html-relative",
				failOnError: false,
			})

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, { map: {} })
			});

			$config.addTemplate("test.njk", `<img src="missing.png">`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 0);
	t.is(templates.length, 1);

	t.is(fs.existsSync("test/stubs-autocopy/_site4/test/missing.png"), false);
	t.is(fs.existsSync("test/stubs-autocopy/_site4/test/index.html"), true);
});

test("Copying dotfiles are not allowed", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site5", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			// WARNING: don’t do this
			$config.addPassthroughCopy("**/*", {
				mode: "html-relative",
				copyOptions: {
					// debug: true,
				}
			});

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, { map: {} })
			});

			$config.addTemplate("test.njk", `<img src=".gitkeep">`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 1);
	t.is(copy[0].count, 0);
	t.is(templates.length, 1);

	t.is(fs.existsSync("test/stubs-autocopy/_site5/.gitkeep"), false);
	t.is(fs.existsSync("test/stubs-autocopy/_site5/test/.gitkeep"), false);
	t.is(fs.existsSync("test/stubs-autocopy/_site5/test/index.html"), true);
});

test("Using with InputPathToUrl plugin", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site6", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			// order of addPlugin shouldn’t matter here
			$config.addPassthroughCopy("**/*.{html,njk}", {
				mode: "html-relative"
			});

			$config.addPlugin(InputPathToUrlTransformPlugin);

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, { map: {} })
			});

			$config.addTemplate("test1.njk", `Test 1`)
			$config.addTemplate("test2.njk", `<a href="test1.njk">Test 2</a>`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 0);
	t.is(templates.length, 2);

	t.is(templates.filter(entry => entry.url.endsWith("/test2/"))[0].content, `<a href="/test1/">Test 2</a>`);

	t.is(fs.existsSync("test/stubs-autocopy/_site6/test2/test1.njk"), false);
	t.is(fs.existsSync("test/stubs-autocopy/_site6/test2/index.html"), true);
});

test("Using with InputPathToUrl plugin (reverse addPlugin order)", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site7", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			// order of addPlugin shouldn’t matter here
			$config.addPlugin(InputPathToUrlTransformPlugin);

			$config.addPassthroughCopy("**/*.{html,njk}", {
				mode: "html-relative"
			});

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, { map: {} })
			});

			$config.addTemplate("test1.njk", `Test 1`)
			$config.addTemplate("test2.njk", `<a href="test1.njk">Test 2</a>`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 0);
	t.is(templates.length, 2);
	t.is(templates.filter(entry => entry.url.endsWith("/test2/"))[0].content, `<a href="/test1/">Test 2</a>`);

	t.is(fs.existsSync("test/stubs-autocopy/_site7/test2/test1.njk"), false);
	t.is(fs.existsSync("test/stubs-autocopy/_site7/test2/index.html"), true);
});

test("Use with HtmlBasePlugin usage", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site8a", {
		configPath: false,
		pathPrefix: "yolo",
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			$config.addPlugin(HtmlBasePlugin);
			$config.addPassthroughCopy("**/*.png", {
				mode: "html-relative"
			});

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, {
					map: {
						"/test/possum.png": TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.png")
					}
				})
			});

			$config.addTemplate("test.njk", `<img src="possum.png"><img src="/test/possum.png">`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 1);
	t.is(templates.length, 1);

	t.deepEqual(templates[0], {
		inputPath: './test/stubs-autocopy/test.njk',
		outputPath: './test/stubs-autocopy/_site8a/test/index.html',
		url: '/test/',
		content: '<img src="possum.png"><img src="/yolo/test/possum.png">',
		rawInput: '<img src="possum.png"><img src="/test/possum.png">'
	});

	t.deepEqual(copy[0], {
		count: 1,
		map: {
			[TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.png")]: TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/_site8a/test/possum.png"),
		}
	});

	t.is(fs.existsSync("test/stubs-autocopy/_site8a/test/possum.png"), true);
	t.is(fs.existsSync("test/stubs-autocopy/_site8a/test/index.html"), true);
});

test("Using with InputPathToUrl plugin and HtmlBasePlugin", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site8b", {
		configPath: false,
		pathPrefix: "yolo",
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			// order of addPlugin shouldn’t matter here
			$config.addPassthroughCopy("**/*.{html,njk}", {
				mode: "html-relative"
			});

			$config.addPlugin(InputPathToUrlTransformPlugin);
			$config.addPlugin(HtmlBasePlugin);

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, { map: {} })
			});

			$config.addTemplate("test1.njk", `Test 1`)
			$config.addTemplate("test2.njk", `<a href="test1.njk">Test 2</a>`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 0);
	t.is(templates.length, 2);

	t.is(templates.filter(entry => entry.url.endsWith("/test2/"))[0].content, `<a href="/yolo/test1/">Test 2</a>`);

	t.is(fs.existsSync("test/stubs-autocopy/_site8b/test2/test1.njk"), false);
	t.is(fs.existsSync("test/stubs-autocopy/_site8b/test2/index.html"), true);
});

test("Multiple addPlugin calls (use both globs)", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site9", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			$config.addPassthroughCopy("**/*.jpg", {
				mode: "html-relative"
			});
			$config.addPassthroughCopy("**/*.png", {
				mode: "html-relative"
			});

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, {
					map: {
						"/test/possum.jpg": TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.jpg"),
						"/test/possum.png": TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.png"),
					}
				})
			});

			$config.addTemplate("test.njk", `<img src="possum.png"><img src="possum.jpg">`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 2);
	t.is(templates.length, 1);

	t.deepEqual(templates[0], {
		inputPath: './test/stubs-autocopy/test.njk',
		outputPath: './test/stubs-autocopy/_site9/test/index.html',
		url: '/test/',
		content: '<img src="possum.png"><img src="possum.jpg">',
		rawInput: '<img src="possum.png"><img src="possum.jpg">'
	});

	t.deepEqual(copy[0], {
		count: 1,
		map: {
			[TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.png")]: TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/_site9/test/possum.png"),
		}
	});
	t.deepEqual(copy[1], {
		count: 1,
		map: {
			[TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.jpg")]: TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/_site9/test/possum.jpg"),
		}
	});

	t.is(fs.existsSync("test/stubs-autocopy/_site9/test/possum.jpg"), true);
	t.is(fs.existsSync("test/stubs-autocopy/_site9/test/possum.png"), true);
	t.is(fs.existsSync("test/stubs-autocopy/_site9/test/index.html"), true);
});

test("Array of globs", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site10", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			$config.addPassthroughCopy(["**/*.jpg", "**/*.png"], {
				mode: "html-relative"
			});

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, {
					map: {
						"/test/possum.jpg": TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.jpg"),
						"/test/possum.png": TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.png"),
					}
				})
			});

			$config.addTemplate("test.njk", `<img src="possum.png"><img src="possum.jpg">`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 2);
	t.is(templates.length, 1);

	t.deepEqual(templates[0], {
		inputPath: './test/stubs-autocopy/test.njk',
		outputPath: './test/stubs-autocopy/_site10/test/index.html',
		url: '/test/',
		content: '<img src="possum.png"><img src="possum.jpg">',
		rawInput: '<img src="possum.png"><img src="possum.jpg">'
	});

	t.deepEqual(copy[0], {
		count: 1,
		map: {
			[TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.png")]: TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/_site10/test/possum.png"),
		}
	});
	t.deepEqual(copy[1], {
		count: 1,
		map: {
			[TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/possum.jpg")]: TemplatePath.normalizeOperatingSystemFilePath("test/stubs-autocopy/_site10/test/possum.jpg"),
		}
	});

	t.is(fs.existsSync("test/stubs-autocopy/_site10/test/possum.jpg"), true);
	t.is(fs.existsSync("test/stubs-autocopy/_site10/test/possum.png"), true);
	t.is(fs.existsSync("test/stubs-autocopy/_site10/test/index.html"), true);
});

test("overwrite: false", async (t) => {
	fs.mkdirSync("./test/stubs-autocopy/_site11/test/", { recursive: true })
	fs.copyFileSync("./test/stubs-autocopy/possum.png", "./test/stubs-autocopy/_site11/test/possum.png");

	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site11", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			$config.addPassthroughCopy("**/*.png", {
				mode: "html-relative",
				copyOptions: {
					overwrite: false,
				}
			});

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, {
					map: {}
				})
			});

			$config.addTemplate("test.njk", `<img src="possum.png">`)
		},
	});

	elev.disableLogger();

	let [copy, templates] = await elev.write();

	t.is(copy.length, 1);
	t.is(templates.length, 1);

	t.deepEqual(templates[0], {
		inputPath: './test/stubs-autocopy/test.njk',
		outputPath: './test/stubs-autocopy/_site11/test/index.html',
		url: '/test/',
		content: '<img src="possum.png">',
		rawInput: '<img src="possum.png">'
	});

	t.deepEqual(copy[0], {
		count: 0,
		map: {}
	});

	t.is(fs.existsSync("test/stubs-autocopy/_site11/test/possum.png"), true);
	t.is(fs.existsSync("test/stubs-autocopy/_site11/test/index.html"), true);
});

test("Input -> output remapping not yet supported (throws error)", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site12", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			// not yet supported
			$config.addPassthroughCopy({"**/*.png": "yo"}, {
				mode: "html-relative"
			});

			$config.on("buildawesome.passthrough", copyMap => {
				t.deepEqual(copyMap, { map: {} })
			});

			$config.addTemplate("test.njk", `<img src="missing.png">`)
		},
	});

	elev.disableLogger();

	await t.throwsAsync(async () => {
		await elev.write();
	}, {
		message: `mode: 'html-relative' does not yet support passthrough copy objects (input -> output mapping). Use a string glob or an Array of string globs.`
	});

	t.is(fs.existsSync("test/stubs-autocopy/_site12/test/index.html"), false);
});

test("Invalid copy mode throws error", async (t) => {
	let elev = new Eleventy("./test/stubs-autocopy/", "./test/stubs-autocopy/_site13", {
		configPath: false,
		config: function ($config) {
			// Node 24: workaround for re-using input directory (and not ignoring all output directories by default)
			$config.ignores.add("./test/stubs-autocopy/_site*/**");

			// not yet supported
			$config.addPassthroughCopy({"**/*.png": "yo"}, {
				mode: "throw-an-error"
			});
		},
	});

	elev.disableLogger();

	await t.throwsAsync(async () => {
		await elev.write();
	}, {
		message: `Invalid \`mode\` option for \`addPassthroughCopy\`. Received: 'throw-an-error'`
	});

	t.is(fs.existsSync("test/stubs-autocopy/_site13/test/index.html"), false);
});
