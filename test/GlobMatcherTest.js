import test from "ava";
import { isGlobMatch } from "../src/Util/GlobMatcher.js";

// Matches tinyglobby, which uses `posix: true`
test("[!...] bracket negation", (t) => {
	t.true(isGlobMatch("src/post.md", ["src/[!_]*.md"]));
	t.true(isGlobMatch("./src/post.md", ["./src/[!_]*.md"]));
	t.false(isGlobMatch("src/_draft.md", ["src/[!_]*.md"]));
	t.false(isGlobMatch("src/_.md", ["src/[!_].md"]));
});
