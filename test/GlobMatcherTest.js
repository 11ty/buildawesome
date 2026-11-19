import test from "node:test";
import { isGlobMatch, createIgnoreMatcher } from "../src/Util/GlobMatcher.js";

// Matches tinyglobby, which uses `posix: true`
test("[!...] bracket negation", (t) => {
	t.assert.strictEqual(isGlobMatch("src/post.md", ["src/[!_]*.md"]), true);
	t.assert.strictEqual(isGlobMatch("./src/post.md", ["./src/[!_]*.md"]), true);
	t.assert.strictEqual(isGlobMatch("src/_draft.md", ["src/[!_]*.md"]), false);
	t.assert.strictEqual(isGlobMatch("src/_.md", ["src/[!_].md"]), false);
});

test("createIgnoreMatcher: last match wins", (t) => {
	let matcher = createIgnoreMatcher(["./site/**", "!./site/events/2018/**"]);
	t.assert.strictEqual(matcher.isIgnored("./site/a.md"), true);
	t.assert.strictEqual(matcher.isIgnored("site/events/2018/b.md"), false);
	t.assert.strictEqual(matcher.isIgnored("site/events/2019/c.md"), true);
	t.assert.strictEqual(matcher.isIgnored("index.md"), false);

	let reignored = createIgnoreMatcher(["site/**", "!site/events/**", "site/events/2019/**"]);
	t.assert.strictEqual(reignored.isIgnored("site/events/2018/b.md"), false);
	t.assert.strictEqual(reignored.isIgnored("site/events/2019/c.md"), true);
});

test("createIgnoreMatcher: directories holding re-included files are traversed", (t) => {
	let matcher = createIgnoreMatcher(["site/**", "!site/events/2018/**"]);
	t.assert.strictEqual(matcher.isIgnored("site", true), false);
	t.assert.strictEqual(matcher.isIgnored("site/events", true), false);
	t.assert.strictEqual(matcher.isIgnored("site/other", true), true);
	t.assert.strictEqual(matcher.isIgnored("site/other", false), true);
});

test("createIgnoreMatcher: getPrunableIgnores", (t) => {
	let matcher = createIgnoreMatcher([
		"./node_modules/**",
		"site/**",
		"!site/events/2018/**",
		"**/node_modules/**",
	]);
	t.assert.deepStrictEqual(matcher.getPrunableIgnores(), ["node_modules/**", "**/node_modules/**"]);
});

test("createIgnoreMatcher: git patterns can’t re-include files in an excluded directory", (t) => {
	let patterns = ["site/**", "!site/events/2018/**"];
	let matcher = createIgnoreMatcher(patterns, { gitPatterns: ["site/**"] });
	t.assert.strictEqual(matcher.isIgnored("site/events", true), true);
	t.assert.strictEqual(matcher.isIgnored("site/events/2018/b.md"), true);
	t.assert.strictEqual(matcher.isIgnored("index.md"), false);
});

test("createIgnoreMatcher: git patterns re-include directory by directory", (t) => {
	let patterns = ["site/*", "!site/events", "site/events/*", "!site/events/2018"];
	let matcher = createIgnoreMatcher(patterns, { gitPatterns: ["site/*", "site/events/*"] });
	t.assert.strictEqual(matcher.isIgnored("site/a.md"), true);
	t.assert.strictEqual(matcher.isIgnored("site/events", true), false);
	t.assert.strictEqual(matcher.isIgnored("site/events/2018/b.md"), false);
	t.assert.strictEqual(matcher.isIgnored("site/events/2019/c.md"), true);
	t.assert.strictEqual(matcher.isIgnored("site/other/d.md"), true);
});
