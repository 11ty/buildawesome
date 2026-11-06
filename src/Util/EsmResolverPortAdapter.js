import module from "node:module";
import { resolve, addToModifiedPaths } from "./EsmResolver.js";
import { getEnvValue } from "./EnvironmentVars.cjs";

// ESM Cache Buster
// - registerHooks requires Node 22.15+ (and is sync only, shipped with v4.0.0-alpha.8)
// - Previous approach was a progressive enhancement using deprecated module.register, Node 18.19+ https://nodejs.org/docs/latest/api/module.html#moduleregisterspecifier-parenturl-options

// Fixes https://github.com/11ty/eleventy/issues/3270

// ENV variable for https://github.com/11ty/eleventy/issues/3371
if (!getEnvValue("SKIP_ESM_RESOLVER")) {
	if ("registerHooks" in module) {
		module.registerHooks({
			// sync-only
			resolve,
		});
	}
}

export function addModifiedPath(path, date) {
	if (getEnvValue("SKIP_ESM_RESOLVER")) {
		return;
	}

	if ("registerHooks" in module) {
		addToModifiedPaths(path, date);
	}
}
