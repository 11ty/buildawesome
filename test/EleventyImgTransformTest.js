import test from "ava";
import Eleventy from "../src/Core.js";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { normalizeNewLines } from "./Util/normalizeNewLines.js";

test("Default image transform with a single image", async (t) => {
  let elev = new Eleventy("./test/stubs-img-transform/single.md", "./test/stubs-img-transform/_site", {
    config: $config => {
      $config.addPlugin(eleventyImageTransformPlugin, {
				extensions: "html",
				dryRun: true,
				formats: ["auto"],
				defaultAttributes: {
					loading: "lazy",
					decoding: "async"
				}
			});
    }
  });

  let [result] = await elev.toJSON();
	t.deepEqual(normalizeNewLines(result.content), `<img src="/single/IdthKOzqFA-350.png" alt="it’s a possum" loading="eager" decoding="async" width="350" height="685">`);
});

test("Default image transform with multiple images", async (t) => {
  let elev = new Eleventy("./test/stubs-img-transform/multiple.md", "./test/stubs-img-transform/_site", {
    config: $config => {
      $config.addPlugin(eleventyImageTransformPlugin, {
				extensions: "html",
				dryRun: true,
				formats: ["auto"],
				defaultAttributes: {
					loading: "lazy",
					decoding: "async"
				}
			});
    }
  });

  let [result] = await elev.toJSON();
	t.deepEqual(normalizeNewLines(result.content).trim(), `<img src="/multiple/IdthKOzqFA-350.png" alt="it’s a possum" loading="eager" decoding="async" width="350" height="685">
<img src="/multiple/IdthKOzqFA-350.png" alt="it’s a possum" loading="lazy" decoding="async" width="350" height="685">`);
});

test("Default image transform with an ignored image", async (t) => {
  let elev = new Eleventy("./test/stubs-img-transform/ignored.md", "./test/stubs-img-transform/_site", {
    config: $config => {
      $config.addPlugin(eleventyImageTransformPlugin, {
				extensions: "html",
				dryRun: true,
				formats: ["auto"],
				defaultAttributes: {
					loading: "lazy",
					decoding: "async"
				}
			});
    }
  });

  let [result] = await elev.toJSON();
	t.deepEqual(normalizeNewLines(result.content), `<img src="./possum.png" alt="it’s a possum" loading="eager">`);
});

test("Missing alt", async (t) => {
  let elev = new Eleventy("./test/stubs-img-transform/missing-alt.md", "./test/stubs-img-transform/_site", {
    config: $config => {
      $config.addPlugin(eleventyImageTransformPlugin, {
				extensions: "html",
				dryRun: true,
				formats: ["auto"],
			});
    }
  });
	elev.setIsVerbose(false);
  elev.disableLogger();

	await t.throwsAsync(async () => {
		await elev.toJSON();
	});
});
