import { assert, test } from "vitest";
import { Markdown } from "../dist/formats/markdown.js";
import { Liquid } from "../dist/formats/liquid.js";
import { Nunjucks } from "../dist/formats/nunjucks.js";
import { I18nPlugin } from "../dist/plugins/plugin-i18n.js";

export default function(BuildAwesome) {
	test("Get version number", async () => {
		assert.typeOf(BuildAwesome.getVersion(), "string");
	});

	test("Markdown (no preprocessor) template", async () => {
		let ba = new BuildAwesome({
			config(configApi) {
				configApi.addEngine("md", Markdown);
				configApi.setMarkdownTemplateEngine(false);
				configApi.setHtmlTemplateEngine(false);
				configApi.setTemplateFormats("md");
				configApi.addTemplate("index.md", `# Heading`);

			}
		});

		let json = await ba.toJSON();
		assert.strictEqual(json[0].content.trim(), `<h1>Heading</h1>`);
	});

	test("Markdown (via Liquid) template", async () => {
		let ba = new BuildAwesome({
			config(configApi) {
				configApi.addEngine("md", Markdown);
				configApi.addEngine("liquid", Liquid);
				configApi.setTemplateFormats("md");
				configApi.addTemplate("index.md", `# {{ title }}`, {
					title: "Heading"
				});

			}
		});

		let json = await ba.toJSON();
		assert.strictEqual(json[0].content.trim(), `<h1>Heading</h1>`);
	});

	test("Liquid template", async () => {
		let ba = new BuildAwesome({
			config(configApi) {
				configApi.addEngine("liquid", Liquid);
				configApi.setTemplateFormats("liquid");
				configApi.addTemplate("index.liquid", `<h1>{{ title }}</h1>`, { title: "Heading" });
			}
		});

		let json = await ba.toJSON();
		assert.strictEqual(json[0].content.trim(), `<h1>Heading</h1>`);
	});

	test("Nunjucks template", async () => {
		let ba = new BuildAwesome({
			config(configApi) {
				configApi.addEngine("njk", Nunjucks);
				configApi.setTemplateFormats("njk");
				configApi.addTemplate("index.njk", `<h1>{{ title }}</h1>`, { title: "Heading" });

			}
		});

		let json = await ba.toJSON();
		assert.strictEqual(json[0].content.trim(), `<h1>Heading</h1>`);
	});

	test("i18n Plugin Use (with 11ty.js)", async () => {
		let ba = new BuildAwesome({
			config(configApi) {
				configApi.addPlugin(I18nPlugin, {
					defaultLanguage: "en"
				});
				configApi.addTemplate("./en/index.11ty.js", function (data) {
					return `<a href="${this.locale_url("/")}">Home</a>`;
				});
				configApi.addTemplate("./es/index.11ty.js", function (data) {
					return `<a href="${this.locale_url("/")}">Home</a>`;
				});
			}
		});

		let json = await ba.toJSON();
		assert.strictEqual(json[0].content.trim(), `<a href="/en/">Home</a>`);
		assert.strictEqual(json[1].content.trim(), `<a href="/es/">Home</a>`);
	});

	// Careful, `@11ty/client` will resolve slugify via Vite instead of it bundled with the package
	test("slugify Filter in Liquid", async () => {
		let ba = new BuildAwesome({
			config(configApi) {
				configApi.addEngine("liquid", Liquid);
				configApi.setTemplateFormats("liquid");
				configApi.addTemplate("index.liquid", `{{ title | slugify }}`, { title: "This is a heading" });
			}
		});

		let json = await ba.toJSON();
		assert.strictEqual(json[0].content.trim(), `this-is-a-heading`);
	});

	// Careful, `@11ty/client` will resolve slugify via Vite instead of it bundled with the package
	test("slugify Filter in Nunjucks", async () => {
		let ba = new BuildAwesome({
			config(configApi) {
				configApi.addEngine("njk", Nunjucks);
				configApi.setTemplateFormats("njk");
				configApi.addTemplate("index.njk", `{{ title | slugify }}`, { title: "This is a heading" });
			}
		});

		let json = await ba.toJSON();
		assert.strictEqual(json[0].content.trim(), `this-is-a-heading`);
	});
}
