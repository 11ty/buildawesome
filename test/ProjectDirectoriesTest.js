import test from "node:test";
import ProjectDirectories from "../src/Util/ProjectDirectories.js";

test("Implied input", t => {
	let d = new ProjectDirectories();

	t.assert.strictEqual(d.input, "./");
	t.assert.strictEqual(d.inputFile, undefined);
});

test("Input matches", t => {
	let d = new ProjectDirectories();
	d.setInput("./test/");

	t.assert.strictEqual(d.input, "./test/");
	t.assert.strictEqual(d.inputFile, undefined);
});

test("Normalized input (has trailing slash)", t => {
	let d = new ProjectDirectories();
	d.setInput("test/");
	t.assert.strictEqual(d.input, "./test/");
	t.assert.strictEqual(d.inputFile, undefined);
});

test("Normalized input (no trailing slash)", t => {
	let d = new ProjectDirectories();
	d.setInput("test");
	t.assert.strictEqual(d.input, "./test/");
	t.assert.strictEqual(d.inputFile, undefined);
});

test("Input must exist", t => {
	let d = new ProjectDirectories();
	t.assert.throws(() => d.setInput("does-not-exist"));
});

test("Input as file", t => {
	let d = new ProjectDirectories();
	d.setInput("test/stubs/index.html");
	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, "./test/stubs/index.html");
});

test("Input as file (deep)", t => {
	let d = new ProjectDirectories();
	d.setInput("test/stubs/img/stub.md");
	t.assert.strictEqual(d.input, "./test/stubs/img/");
	t.assert.strictEqual(d.inputFile, "./test/stubs/img/stub.md");
});

test("Input as file (deep with inputDir)", t => {
	let d = new ProjectDirectories();
	d.setInput("test/stubs/img/stub.md", "test/stubs");
	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, "./test/stubs/img/stub.md");
});

test("Data directory, implied input and default data", t => {
	let d = new ProjectDirectories();
	t.assert.strictEqual(d.data, "./_data/");
});

test("Data directory matches, explicit input", t => {
	let d = new ProjectDirectories();
	d.setInput("./test/");
	t.assert.strictEqual(d.data, "./test/_data/");
});

test("Data directory matches, explicit input and data", t => {
	let d = new ProjectDirectories();
	d.setInput("./test/");
	d.setData("mydata");
	t.assert.strictEqual(d.data, "./test/mydata/");
});

test("Data directory matches, explicit input and data (order reversed)", t => {
	let d = new ProjectDirectories();
	d.setData("mydata");
	d.setInput("./test/");
	t.assert.strictEqual(d.data, "./test/mydata/");
});

test("includes implied, layouts are not", t => {
	let d = new ProjectDirectories();
	t.assert.strictEqual(d.layouts, undefined);
	t.assert.strictEqual(d.includes, "./_includes/");
});

test("Layouts/includes, explicit", t => {
	let d = new ProjectDirectories();
	d.setLayouts("layouts");
	d.setIncludes("includes");
	t.assert.strictEqual(d.layouts, "./layouts/");
	t.assert.strictEqual(d.includes, "./includes/");

	d.setInput("test");
	t.assert.strictEqual(d.layouts, "./test/layouts/");
	t.assert.strictEqual(d.includes, "./test/includes/");

	d.setLayouts("../layouts");
	d.setIncludes("../includes");
	t.assert.strictEqual(d.layouts, "./layouts/");
	t.assert.strictEqual(d.includes, "./includes/");
});

test("Output, implied", t => {
	let d = new ProjectDirectories();
	t.assert.strictEqual(d.output, "./_site/");
});

test("Content/template/input paths", t => {
	let d = new ProjectDirectories();
	t.assert.strictEqual(d.getInputPath("test.md"), "./test.md");
	t.assert.strictEqual(d.getInputPath("./test.md"), "./test.md");
	t.assert.strictEqual(d.getLayoutPath("./layout.html"), "./_includes/layout.html");

	d.setInput("test");
	t.assert.strictEqual(d.getInputPath("test.md"), "./test/test.md");
	t.assert.strictEqual(d.getInputPath("./test.md"), "./test/test.md");
	t.assert.strictEqual(d.getLayoutPath("./layout.html"), "./test/_includes/layout.html");
});

test("Project file paths", t => {
	let d = new ProjectDirectories();
	t.assert.strictEqual(d.getProjectPath("eleventy.config.js"), "./eleventy.config.js");
	t.assert.strictEqual(d.getProjectPath("./eleventy.config.js"), "./eleventy.config.js");
});

test("Input could be a glob!", t => {
	let d = new ProjectDirectories();
	d.setInput("./test/*.md");
	t.assert.strictEqual(d.input, "./test/");
	t.assert.strictEqual(d.inputFile, undefined);
});


test("Setting values via config object", t => {
	let d = new ProjectDirectories();

	d.setViaConfigObject({
		input: "test/stubs",
		output: "dist",
	});

	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./dist/");
	t.assert.strictEqual(d.data, "./test/stubs/_data/");
	t.assert.strictEqual(d.includes, "./test/stubs/_includes/");
	t.assert.strictEqual(d.layouts, undefined);
});

test("Setting values via config object (input relative dirs)", t => {
	let d = new ProjectDirectories();
	d.setViaConfigObject({
		input: "test/stubs",
		data: "globaldata",
		layouts: "mylayouts",
		includes: "components",
	});

	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./_site/");
	t.assert.strictEqual(d.data, "./test/stubs/globaldata/");
	t.assert.strictEqual(d.includes, "./test/stubs/components/");
	t.assert.strictEqual(d.layouts, "./test/stubs/mylayouts/");
});

test("Setting values via config object (input relative dirs, parent dirs)", t => {
	let d = new ProjectDirectories();
	d.setViaConfigObject({
		input: "test/stubs",
		data: "../globaldata",
		includes: "../components",
	});

	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./_site/");
	t.assert.strictEqual(d.data, "./test/globaldata/");
	t.assert.strictEqual(d.includes, "./test/components/");
	t.assert.strictEqual(d.layouts, undefined);
});

test("Setting values via config object (eleventy-base-blog example)", t => {
	let d = new ProjectDirectories();
	d.setViaConfigObject({
		input: "src",
		includes: "../_includes",
		data: "../_data",
		output: "_site"
	});

	t.assert.strictEqual(d.input, "./src/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./_site/");
	t.assert.strictEqual(d.data, "./_data/");
	t.assert.strictEqual(d.includes, "./_includes/");
	t.assert.strictEqual(d.layouts, undefined);
});

test("Setting values via config object (empty string/false value)", t => {
	let d = new ProjectDirectories();
	d.setViaConfigObject({
		input: "test/stubs",
		output: "_site",
		data: false, // falsy supported for output, data, includes, and layouts (uses input dir)
		includes: "",
		// layouts will be undefined when excluded here
	});

	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./_site/");
	t.assert.strictEqual(d.data, "./test/stubs/");
	t.assert.strictEqual(d.includes, "./test/stubs/");
	t.assert.strictEqual(d.layouts, undefined);
});

test("Setting values via config object (layouts is set but falsy)", t => {
	let d = new ProjectDirectories();
	d.setViaConfigObject({
		input: "test/stubs",
		output: "_site",
		layouts: "", // falsy supported for output, data, includes, and layouts (uses input dir)
	});

	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./_site/");
	t.assert.strictEqual(d.data, "./test/stubs/_data/");
	t.assert.strictEqual(d.includes, "./test/stubs/_includes/");
	t.assert.strictEqual(d.layouts, "./test/stubs/");
});

test("Setting values via config object (output is falsy)", t => {
	let d = new ProjectDirectories();
	d.setViaConfigObject({
		input: "test/stubs",
		output: "",
	});

	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./");
	t.assert.strictEqual(d.data, "./test/stubs/_data/");
	t.assert.strictEqual(d.includes, "./test/stubs/_includes/");
	t.assert.strictEqual(d.layouts, undefined);
});

test("Setting values via config object (dots)", t => {
	let d = new ProjectDirectories();
	d.setViaConfigObject({
		input: "test/stubs",
		output: ".",
		includes: ".",
		layouts: ".",
		data: ".",
	});

	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./");
	t.assert.strictEqual(d.data, "./test/stubs/");
	t.assert.strictEqual(d.includes, "./test/stubs/");
	t.assert.strictEqual(d.includes, "./test/stubs/");
});

test("CLI values should override all others (both)", t => {
	let d = new ProjectDirectories();
	d.setInput("src");
	d.setOutput("dist");
	d.freeze();

	d.setViaConfigObject({
		input: "test/stubs",
		includes: "myincludes",
	});

	t.assert.strictEqual(d.input, "./src/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./dist/");
	t.assert.strictEqual(d.data, "./src/_data/");
	t.assert.strictEqual(d.includes, "./src/myincludes/");
	t.assert.strictEqual(d.layouts, undefined);
});

test("CLI values should override all others (just input)", t => {
	let d = new ProjectDirectories();
	d.setInput("src");
	d.freeze();

	d.setViaConfigObject({
		input: "test/stubs",
		includes: "myincludes", // always okay, not a CLI param
		output: "dist",
	});

	t.assert.strictEqual(d.input, "./src/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./dist/");
	t.assert.strictEqual(d.data, "./src/_data/");
	t.assert.strictEqual(d.includes, "./src/myincludes/");
	t.assert.strictEqual(d.layouts, undefined);
});

test("CLI values should override all others (just output)", t => {
	let d = new ProjectDirectories();
	d.setOutput("dist");
	d.freeze();

	d.setViaConfigObject({
		input: "test/stubs",
		includes: "myincludes", // always okay, not a CLI param
		output: "someotherdir",
	});

	t.assert.strictEqual(d.input, "./test/stubs/");
	t.assert.strictEqual(d.inputFile, undefined);
	t.assert.strictEqual(d.output, "./dist/");
	t.assert.strictEqual(d.data, "./test/stubs/_data/");
	t.assert.strictEqual(d.includes, "./test/stubs/myincludes/");
	t.assert.strictEqual(d.layouts, undefined);
});

test("getLayoutPath (layouts dir)", t => {
	let d = new ProjectDirectories();
	d.setViaConfigObject({
		input: "test/stubs",
		layouts: "mylayouts",
		includes: "components",
	});

	t.assert.strictEqual(d.getLayoutPath("layout.html"), "./test/stubs/mylayouts/layout.html");
	t.assert.strictEqual(d.getLayoutPathRelativeToInputDirectory("layout.html"), "mylayouts/layout.html");
});

test("getLayoutPath (includes dir)", t => {
	let d = new ProjectDirectories();
	d.setViaConfigObject({
		input: "test/stubs",
		includes: "components",
	});

	t.assert.strictEqual(d.getLayoutPath("layout.html"), "./test/stubs/components/layout.html");
	t.assert.strictEqual(d.getLayoutPathRelativeToInputDirectory("layout.html"), "components/layout.html");
});

test("isFileIn*Folder", t => {
	let d = new ProjectDirectories();

	t.assert.strictEqual(d.isFileInProjectFolder("test.njk"), true);
	t.assert.strictEqual(d.isFileInProjectFolder("../test.njk"), false);

	t.assert.strictEqual(d.isFileInOutputFolder("test.njk"), false);
	t.assert.strictEqual(d.isFileInOutputFolder("../test.njk"), false);
	t.assert.strictEqual(d.isFileInOutputFolder("../_site/test.html"), false);
	t.assert.strictEqual(d.isFileInOutputFolder("_site/test.html"), true);
});

test("isFileInOutputFolder (change output folder)", t => {
	let d = new ProjectDirectories();
	d.setOutput("yolo")

	t.assert.strictEqual(d.isFileInOutputFolder("test.njk"), false);
	t.assert.strictEqual(d.isFileInOutputFolder("../test.njk"), false);
	t.assert.strictEqual(d.isFileInOutputFolder("_site/test.html"), false);
	t.assert.strictEqual(d.isFileInOutputFolder("../_site/test.html"), false);
	t.assert.strictEqual(d.isFileInOutputFolder("yolo/test.html"), true);
});

test("isTemplateFile with project root relative paths", t => {
	let d = new ProjectDirectories();
	d.setInput("test/stubs");

	t.assert.strictEqual(d.isTemplateFile("./test/stubs/index.njk"), true);
	t.assert.strictEqual(d.isTemplateFile("test/stubs/sub/index.njk"), true);
	t.assert.strictEqual(d.isTemplateFile(`${process.cwd()}/test/stubs/index.njk`), true);
	t.assert.strictEqual(d.isTemplateFile("./test/stubs/_includes/base.njk"), false);
	t.assert.strictEqual(d.isTemplateFile("./test/stubs/_data/site.json"), false);
	t.assert.strictEqual(d.isTemplateFile("./test/stubs-other/index.njk"), false);
	t.assert.strictEqual(d.isTemplateFile("./index.njk"), false);
});

test("isTemplateFile with the default input directory", t => {
	let d = new ProjectDirectories();

	t.assert.strictEqual(d.isTemplateFile("index.njk"), true);
	t.assert.strictEqual(d.isTemplateFile("./sub/index.njk"), true);
	t.assert.strictEqual(d.isTemplateFile("./_includes/base.njk"), false);
	t.assert.strictEqual(d.isTemplateFile("./_data/site.json"), false);
	t.assert.strictEqual(d.isTemplateFile("../index.njk"), false);
});
