import test from "node:test";
import { isGlobMatch } from "../src/Util/GlobMatcher.js";

// Matches tinyglobby, which uses `posix: true`
test("[!...] bracket negation", (t) => {
	t.assert.strictEqual(isGlobMatch("src/post.md", ["src/[!_]*.md"]), true);
	t.assert.strictEqual(isGlobMatch("./src/post.md", ["./src/[!_]*.md"]), true);
	t.assert.strictEqual(isGlobMatch("src/_draft.md", ["src/[!_]*.md"]), false);
	t.assert.strictEqual(isGlobMatch("src/_.md", ["src/[!_].md"]), false);
});
