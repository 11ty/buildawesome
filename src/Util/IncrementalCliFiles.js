import { existsSync } from "node:fs";
import { TemplatePath } from "@11ty/eleventy-utils";
import { glob } from "tinyglobby";
import { isDynamicPattern } from "./GlobMatcher.js";

function splitTargets(value) {
	const closing = { "{": "}", "[": "]", "(": ")" };
	const stack = [];
	const commas = [];

	for (let index = 0; index < value.length; index++) {
		const char = value[index];
		if (char === "\\") {
			index++;
		} else if (char === stack.at(-1)?.close) {
			// Only a completed glob group can own its commas. An unmatched
			// bracket may be part of an ordinary filename.
			commas.length = stack.pop().commaCount;
		} else if (char === ",") {
			commas.push(index);
		} else if (stack.at(-1)?.close !== "]" && Object.hasOwn(closing, char)) {
			stack.push({ close: closing[char], commaCount: commas.length });
		}
	}

	const targets = [];
	let start = 0;
	for (const index of commas) {
		targets.push(value.slice(start, index));
		start = index + 1;
	}
	targets.push(value.slice(start));
	return targets;
}

export async function resolveIncrementalCliFiles(value, ignore) {
	// A single flag accepts comma-separated targets. Repeated flags already delimit targets.
	const targets = Array.isArray(value) ? value : splitTargets(value);
	const files = new Set();
	for (const target of targets) {
		if (!isDynamicPattern(target) || existsSync(target)) {
			files.add(TemplatePath.addLeadingDotSlash(target));
			continue;
		}

		const matches = await glob(target, {
			caseSensitiveMatch: false,
			dot: true,
			onlyFiles: true,
			ignore,
		});
		if (matches.length === 0) {
			throw new Error(`Incremental pattern matched no files: ${target}`);
		}
		for (const file of matches) {
			files.add(TemplatePath.addLeadingDotSlash(file));
		}
	}

	return Array.from(files);
}
