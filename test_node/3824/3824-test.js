// This test file is using Node’s test runner because `tsx` doesn’t work with worker threads (used by avajs)
// See https://github.com/privatenumber/tsx/issues/354
// See https://github.com/nodejs/node/issues/47747
import test from "node:test";
import fs from "node:fs";
import assert from "node:assert";

import Eleventy from "../../src/Core.js";

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
	async () => {
		let comparisonStrings = ["first", "second"];

		let runs = comparisonStrings.map((str) => {
			return {
				...Promise.withResolvers(),
				input: getInputContent(str),
				expected: getOutputContent(str),
			};
		});

		// Restore original content
		const ROOT_DIR = "./test_node/3824/";
		const OUTPUT_DIR = ROOT_DIR + "_site/";

		const FILE_CHANGING = ROOT_DIR + "_includes/head.tsx";
		const OUTPUT_FILE = OUTPUT_DIR + "index.html";

		fs.writeFileSync(FILE_CHANGING, getInputContent(), "utf8");

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

		fs.writeFileSync(FILE_CHANGING, getInputContent(), "utf8");
		fs.rmSync(OUTPUT_DIR, { recursive: true });
	},
);
