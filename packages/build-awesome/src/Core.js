import Core from "@11ty/eleventy";
import pkg from "../package.json" with { type: "json" };

export * from "@11ty/eleventy";

export default class BuildAwesome extends Core {
	static packageName = pkg.name.split("/").pop();
}

export { BuildAwesome };
