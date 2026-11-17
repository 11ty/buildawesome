import test from "node:test";
import Eleventy from "../src/Core.js";

function getElev(templateData) {
	return new Eleventy("test/noop", false, {
		config($config) {
			$config.addGlobalData("langs", ["en", "fr"]);
			$config.addGlobalData("pagination", { data: "langs", size: 1, alias: "lang" });
			$config.addTemplate("index.11ty.js", {
				data: templateData,
				render(data) {
					return data.lang ?? "none";
				},
			});
		},
	});
}

test("#2292 Global pagination applies to templates", async (t) => {
	let results = await getElev({}).toJSON();
	t.assert.deepStrictEqual(results.map(({ url, content }) => [url, content]).sort(), [
		["/", "en"],
		["/1/", "fr"],
	]);
});

for (let value of [false, null, ""]) {
	test(`#2292 \`override:pagination: ${JSON.stringify(value)}\` disables global pagination`, async (t) => {
		let results = await getElev({ "override:pagination": value }).toJSON();
		t.assert.deepStrictEqual(results.map(({ url, content }) => [url, content]), [["/", "none"]]);
	});
}
