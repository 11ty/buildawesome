import test from "node:test";
import fs from "node:fs";
import assert from "node:assert";

import Eleventy from "../src/Core.js";

// This tests Eleventy Watch and the file system!

function getInputContent(str = "") {
	return `import { Page } from "./ViewProps.js";

export type HeadProps = {
  page: Page
};

export function Head(props: HeadProps): JSX.Element {
  return <head>
    <title>My test page${str}</title>
  </head>;
}`;
}

function getOutputContent(str = "") {
	return `<html><head><title>My test page${str}</title></head><body><p>Hello World</p></body></html>`;
}

test(
	"#3824 TSX updates during watch",
	{
		timeout: 10000,
	},
	async (t) => {
		let comparisonStrings = ["first", "second"];

		let runs = comparisonStrings.map((str) => {
			return {
				...Promise.withResolvers(),
				input: getInputContent(str),
				expected: getOutputContent(str),
			};
		});

		const ROOT_DIR = "./test/_generated/3824/";
		fs.rmSync(ROOT_DIR, { recursive: true, force: true });
		fs.cpSync("./test/stubs-3824/", ROOT_DIR, { recursive: true, filter: (src) => !src.includes("_site") });
		t.after(() => fs.rmSync(ROOT_DIR, { recursive: true, force: true }));
		const OUTPUT_DIR = ROOT_DIR + "_site/";

		const FILE_CHANGING = ROOT_DIR + "_includes/head.tsx";
		const OUTPUT_FILE = OUTPUT_DIR + "index.html";

		let index = 0;
		let elev = new Eleventy(ROOT_DIR, OUTPUT_DIR, {
			configPath: ROOT_DIR + "eleventy.config.js",
			config(eleventyConfig) {
				eleventyConfig.on("buildawesome.afterwatch", () => {
					let { resolve } = runs[index];
					index++;
					resolve();
				});
			},
		});

		elev.disableLogger();
		await elev.init();
		await elev.watch();

		// Control
		let content = fs.readFileSync(OUTPUT_FILE, "utf8");
		assert.equal(content, getOutputContent());

		// Stop after all runs are complete
		Promise.all(runs.map((entry) => entry.promise)).then(async () => {
			await elev.stopWatch();
		});

		for (let run of runs) {
			// Windows/Ubuntu needed this for Chokidar reasons
			await new Promise((resolve) => setTimeout(resolve, 200));
			fs.writeFileSync(FILE_CHANGING, run.input, "utf8");

			await run.promise;

			let content = fs.readFileSync(OUTPUT_FILE, "utf8");
			assert.equal(content, run.expected);
		}
	},
);
