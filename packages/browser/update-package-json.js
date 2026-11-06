// Intended to run from repository root in release.sh script

import fs from "node:fs";
import corePkg from "../../package.json" with { type: "json" };

// assign new version in local package.json from core package.json
import clientPkg from "./package.json" with { type: "json" };

clientPkg.version = corePkg.version;
delete clientPkg.private; // allow publish

if (
	corePkg.name !== "@11ty/eleventy" ||
	clientPkg.name !== "@11ty/client" ||
	!fs.existsSync("./packages/browser/package.json")
) {
	throw new Error(
		"Did you run this script from the wrong directory? (Should be the repository root)",
	);
}

fs.writeFileSync("./packages/browser/package.json", JSON.stringify(clientPkg, null, 2), "utf8");
console.log(`[11ty/bundle/client] Updated @11ty/client package version to ${corePkg.version}`);
