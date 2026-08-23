import { createDebug as createDebugObug } from "obug";
import { isUsingBuildAwesome } from "./IsBuildAwesome.js";

const PREFIX = isUsingBuildAwesome() ? "BuildAwesome:" : "Eleventy:";

export function createDebug(name) {
	return createDebugObug(`${PREFIX}:${name}`);
}
