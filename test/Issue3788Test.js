import test from "ava";
import Eleventy from "../src/Core.js";

test("#3788 Nunjucks shortcodes args", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config($config) {
			$config.addTemplate("index.njk", `{% test %}:{% test "" %}`);

			$config.addShortcode("test", (args) => {
				return JSON.stringify(args);
			})
		}
	});

	let [result] = await elev.toJSON();

	t.is(result.content, `undefined:""`);
});
