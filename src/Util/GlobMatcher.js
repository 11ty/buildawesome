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

function isOverlappingBase(a, b) {
	return a === "" || b === "" || a === b || a.startsWith(b + "/") || b.startsWith(a + "/");
}

export function hasNegatedPattern(patterns = []) {
	return patterns.some((entry) => entry.startsWith("!"));
}

// Ordered ignore patterns where the last match wins and `!pattern` re-includes.
// `gitPatterns` follow .gitignore rules: files in a directory they exclude can’t be re-included.
export function createIgnoreMatcher(patterns = [], { gitPatterns = [], ...options } = {}) {
	let opts = Object.assign({ dot: true, nocase: true, posix: true }, options);
	let gitGlobs = new Set(
		Array.from(gitPatterns, (entry) => TemplatePath.stripLeadingDotSlash(entry)),
	);
	let rules = patterns.map((entry) => {
		let negated = entry.startsWith("!");
		let glob = TemplatePath.stripLeadingDotSlash(negated ? entry.slice(1) : entry);
		return {
			negated,
			glob,
			git: !negated && gitGlobs.has(glob),
			base: picomatch.scan(glob).base.toLowerCase(),
			isMatch: picomatch(glob, opts),
		};
	});

	function hasLaterNegation(index, base) {
		return rules
			.slice(index + 1)
			.some((rule) => rule.negated && isOverlappingBase(rule.base, base));
	}

	function getLastMatch(inputPath) {
		return rules.findLast((rule) => rule.isMatch(inputPath));
	}

	return {
		patterns,
		gitPatterns: Array.from(gitGlobs),
		// Ignores that no later negation can re-include, safe for the crawler to prune.
		getPrunableIgnores() {
			return rules
				.filter((rule, index) => !rule.negated && !hasLaterNegation(index, rule.base))
				.map((rule) => rule.glob);
		},
		isIgnored(filepath, isDirectory = false) {
			let inputPath = TemplatePath.stripLeadingDotSlash(filepath);
			let segments = inputPath.split("/");
			for (let depth = 1; depth < segments.length; depth++) {
				if (getLastMatch(segments.slice(0, depth).join("/"))?.git) {
					return true;
				}
			}

			let rule = getLastMatch(inputPath);
			if (!rule || rule.negated) {
				return false;
			}
			// Keep traversing a directory that holds re-included files.
			return (
				rule.git || !(isDirectory && hasLaterNegation(rules.indexOf(rule), inputPath.toLowerCase()))
			);
		},
	};
}
