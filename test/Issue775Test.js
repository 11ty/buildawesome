import test from "ava";
import Eleventy from "../src/Core.js";

test("#775 Using data cascade in Collection API", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config($config) {
			$config.addCollection("apic", collectionApi => {
				return collectionApi.getFilteredByTag("posts").filter(entry => {
					return entry.data.keep;
				});
			})
			$config.addTemplate("post1.md", `# Header`, { tags: "posts", keep: true });
			$config.addTemplate("post2.md", `# Header`, { tags: "posts" });
			$config.addTemplate("post3.md", `# Header`, { tags: "posts" });
			$config.addTemplate("index.njk", `{{ collections.apic.length }}`);
		}
	});


	let [result] = await elev.toJSON();
	t.is(result.content, "1");
});
