import test from "ava";
import Eleventy from "../src/Core.js";

test("parseDateString filter (njk)", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config($config) {
			$config.addTemplate("index.njk", `{{ "2018-01-01" | parseDateString | dateToISO }}`);
			$config.addFilter("dateToISO", (date) => date.toISOString());
		},
	});
	let results = await elev.toJSON();
	t.is(results[0].content, "2018-01-01T00:00:00.000Z");
});

test("parseDateString filter (liquid)", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config($config) {
			$config.addTemplate("index.liquid", `{{ "2018-01-01T12:30:00-06:00" | parseDateString | dateToISO }}`);
			$config.addFilter("dateToISO", (date) => date.toISOString());
		},
	});
	let results = await elev.toJSON();
	t.is(results[0].content, "2018-01-01T18:30:00.000Z");
});

test("parseDateString filter can be overridden by project config", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		configPath: "./test/stubs/parse-date-string-override.config.js",
		config($config) {
			$config.addTemplate("index.njk", `{{ "2018-01-01" | parseDateString }}`);
		},
	});
	let results = await elev.toJSON();
	t.is(results[0].content, "custom");
});
