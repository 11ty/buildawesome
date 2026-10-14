// Intended to run from repository root in release.sh script

import fs from "node:fs";
import corePkg from "../../package.json" with { type: "json" };

// assign new version in local package.json from core package.json
import buildawesomePkg from "./package.json" with { type: "json" };

buildawesomePkg.version = corePkg.version;
buildawesomePkg.dependencies[corePkg.name] = corePkg.version;
delete buildawesomePkg.private; // allow publish

if (
	corePkg.name !== "@11ty/eleventy" ||
	buildawesomePkg.name !== "@awesome.me/buildawesome" ||
	!fs.existsSync("./packages/build-awesome/package.json")
) {
	throw new Error(
		"Did you run this script from the wrong directory? (Should be the repository root)",
	);
}

fs.writeFileSync(
	"./packages/build-awesome/package.json",
	JSON.stringify(buildawesomePkg, null, 2),
	"utf8",
);
console.log(
	`[awesome.me/buildawesome] Updated @awesome.me/buildawesome package version to ${corePkg.version}`,
);
