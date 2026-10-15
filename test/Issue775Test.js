import test from "ava";
import Eleventy from "../src/Eleventy.js";

test("#775 Using data cascade in Collection API", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addCollection("apic", collectionApi => {
				return collectionApi.getFilteredByTag("posts").filter(entry => {
					return entry.data.keep;
				});
			})
			eleventyConfig.addTemplate("post1.md", `# Header`, { tags: "posts", keep: true });
			eleventyConfig.addTemplate("post2.md", `# Header`, { tags: "posts" });
			eleventyConfig.addTemplate("post3.md", `# Header`, { tags: "posts" });
			eleventyConfig.addTemplate("index.njk", `{{ collections.apic.length }}`);
		}
	});


	let results = await elev.toJSON();
	let [result] = results.filter((entry) => entry.url === "/");
	t.is(result.content, "1");
});
