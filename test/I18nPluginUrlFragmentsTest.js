import test from "node:test";
import Eleventy from "../src/Core.js";
import I18nPlugin from "../src/Plugins/I18nPlugin.js";

for (let errorMode of ["strict", "allow-fallback", "never"]) {
	test(`locale_url preserves fragments (${errorMode})`, async (t) => {
		let urls = ["/#heading", "/en/#heading", "/en#heading", "/#", "/#heading%20one#two"];
		let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
			config: function (config) {
				config.addPlugin(I18nPlugin, { defaultLanguage: "en", errorMode });
				let template = urls.map((url) => `{{ "${url}" | locale_url }}`).join("\n");
				template += '\n{{ "/#heading" | locale_url("en-us") }}';
				for (let lang of ["en", "es", "en-us"]) {
					config.addTemplate(`${lang}/index.njk`, template);
				}
				config.addTemplate("index.njk", '{{ "/#heading" | locale_url }}');
			},
		});

		let results = await elev.toJSON();
		for (let lang of ["en", "es", "en-us"]) {
			t.assert.strictEqual(
				results.find((entry) => entry.url === `/${lang}/`).content,
				`/${lang}/#heading\n/${lang}/#heading\n/${lang}/#heading\n/${lang}/#\n/${lang}/#heading%20one#two\n/en-us/#heading`,
			);
		}
		t.assert.strictEqual(results.find((entry) => entry.url === "/").content, "/en/#heading");
	});
}

for (let errorMode of ["allow-fallback", "never"]) {
	test(`locale_url preserves fragments on a non-localized fallback (${errorMode})`, async (t) => {
		let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
			config: function (config) {
				config.addPlugin(I18nPlugin, { defaultLanguage: "en", errorMode });
				config.addTemplate("shared.njk", "Shared page");
				config.addTemplate("es/index.njk", '{{ "/shared/#heading" | locale_url }}');
			},
		});

		let results = await elev.toJSON();
		t.assert.strictEqual(
			results.find((entry) => entry.url === "/es/").content,
			"/shared/#heading",
		);
	});
}

test("locale_url still rejects a non-localized fallback with a fragment in strict mode", async (t) => {
	let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
		config: function (config) {
			config.addPlugin(I18nPlugin, { defaultLanguage: "en" });
			config.addTemplate("shared.njk", "Shared page");
			config.addTemplate("es/index.njk", '{{ "/shared/#heading" | locale_url }}');
		},
	});
	elev.disableLogger();
	await t.assert.rejects(() => elev.toJSON());
});

test("locale_url leaves fragment-only and external links unchanged", async (t) => {
	let elev = new Eleventy("./test/stubs-empty/", "./test/stubs-empty/_site", {
		config: function (config) {
			config.addPlugin(I18nPlugin, { defaultLanguage: "en", errorMode: "never" });
			config.addTemplate(
				"es/index.njk",
				'{{ "#heading" | locale_url }}\n{{ "https://example.com/#heading" | locale_url }}',
			);
		},
	});

	let results = await elev.toJSON();
	t.assert.strictEqual(results[0].content, "#heading\nhttps://example.com/#heading");
});
