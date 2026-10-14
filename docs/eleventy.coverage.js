import { dirname } from "path";
import { fileURLToPath } from "url";
import { TemplatePath } from "@11ty/eleventy-utils";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function (config) {
	config.addFilter("removeDir", function (str) {
		return TemplatePath.stripLeadingSubPath(str, TemplatePath.join(__dirname, ".."));
	});

	return {
		templateFormats: ["njk"],
		dir: {
			input: "docs/coverage.njk",
			output: "docs/", // root relative
		},
	};
}
