import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import * as sass from "sass";

import Eleventy from "../../../src/Core.js";

const DIR = "./test/_issues/2999/";
const PARTIAL = `${DIR}_shared.scss`;
const ORIGINAL = `body {\n  background: gold;\n}\n`;

test("Custom engine recompiles when an addDependencies partial in the input dir changes #2999", async (t) => {
	fs.writeFileSync(PARTIAL, ORIGINAL, "utf8");
	t.after(() => fs.writeFileSync(PARTIAL, ORIGINAL, "utf8"));

	let elev = new Eleventy(DIR, `${DIR}_site`, {
		config($config) {
			$config.addTemplateFormats("scss");
			$config.addExtension("scss", {
				outputFileExtension: "css",
				compile(inputContent, inputPath) {
					let parsed = path.parse(inputPath);
					if (parsed.name.startsWith("_")) {
						return;
					}

					let result = sass.compileString(inputContent, { loadPaths: [parsed.dir] });
					this.addDependencies(inputPath, result.loadedUrls);

					return () => result.css;
				},
			});
		},
	});

	let getCss = (results) => results.find((entry) => entry.inputPath.endsWith("index.scss")).content;

	t.assert.match(getCss(await elev.toJSON()), /background: gold/);

	fs.writeFileSync(PARTIAL, ORIGINAL.replace("gold", "red"), "utf8");
	elev.setIncrementalFiles(PARTIAL);

	t.assert.match(getCss(await elev.toJSON()), /background: red/);
});
