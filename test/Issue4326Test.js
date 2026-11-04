import test from "node:test";
import Eleventy from "../src/Core.js";

test("#4326 Templates paginating over a tag are in config API collections", async (t) => {
	let warnings = [];
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addCollection("menuPages", (collectionApi) => {
				return collectionApi.getAll().filter((item) => item.data.mainMenu);
			});

			eleventyConfig.addTemplate("about.md", "About", { mainMenu: true, permalink: "/about/" });
			eleventyConfig.addTemplate("post1.md", "Post", { tags: "thoughts" });
			eleventyConfig.addTemplate("post2.md", "Post", { tags: "thoughts" });
			eleventyConfig.addTemplate("thoughts.liquid", "{{ pageItems.length }}", {
				mainMenu: true,
				pagination: { data: "collections.thoughts", size: 1, alias: "pageItems" },
			});
			eleventyConfig.addTemplate(
				"menu.liquid",
				"{% for p in collections.menuPages %}{{ p.url }} {% endfor %}",
				{ permalink: "/menu/" },
			);
		},
	});
	elev.setIsVerbose(true);
	elev.logger.overrideLogger({
		log() {},
		info() {},
		error() {},
		warn(message) {
			warnings.push(message);
		},
	});

	let results = await elev.toJSON();
	let menu = results.find((entry) => entry.url === "/menu/");
	t.assert.strictEqual(menu.content.trim(), "/about/ /thoughts/");
	t.assert.deepStrictEqual(warnings, []);
});
