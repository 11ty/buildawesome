// picomatch costs ~50KB minified
import picomatch from "picomatch";
import { TemplatePath } from "@11ty/eleventy-utils";

export function isGlobMatch(filepath, globs = [], options = undefined) {
	if (!filepath || !Array.isArray(globs) || globs.length === 0) {
		return false;
	}

	let inputPath = TemplatePath.stripLeadingDotSlash(filepath);
	let opts = Object.assign(
		{
			dot: true,
			nocase: true, // insensitive
			posix: true,
		},
		options,
	);

	// globs: string or array of strings
	return picomatch.isMatch(inputPath, globs, opts);
}

// via tinyglobby
export function isDynamicPattern(pattern) {
	const s = picomatch.scan(pattern);
	return s.isGlob || s.negated;
}
