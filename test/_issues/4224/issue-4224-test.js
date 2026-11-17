import test from "node:test";
import Eleventy from "../../../src/Core.js";

test("Mixed-case extensions for templates, layouts and data files #4224", async (t) => {
	let elev = new Eleventy("./test/_issues/4224/", "./test/_issues/4224/_site", {
		config($config) {
			$config.addDataExtension("YAML", (content) => {
				let [key, value] = content.trim().split(": ");
				return { [key]: value };
			});
			$config.addTemplateFormats("vZome");
			$config.addExtension("vZome", {
				compile(str) {
					return (data) =>
						str
							.replace(/\{\{ ([\w.]+) \}\}/g, (match, key) =>
								key.split(".").reduce((obj, prop) => obj?.[prop], data) ?? "",
							)
							.trim();
				},
			});
		},
	});
	elev.disableLogger();

	let results = Object.fromEntries((await elev.toJSON()).map((entry) => [entry.url, entry.content]));
	t.assert.deepStrictEqual(results, {
		"/": "mixed-case custom extension",
		"/child/": "Layout TDF|GLOBAL-JSON|GLOBAL-YAML",
		"/sub/page/": "Layout DIR",
	});
});
