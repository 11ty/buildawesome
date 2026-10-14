import fs from "node:fs";
import chalk from "kleur";
import { default as bundleClient } from "@11ty/package-bundler";

import pkg from "../../package.json" with { type: "json" };
import { readableFileSize } from "../../src/Util/FileSize.js";

const PREFIX = chalk.dim(`[11ty/bundle/client] `);

function size(filepath) {
	return readableFileSize(fs.statSync(filepath).size);
}

await bundleClient("./src/BundleCoreMinimal.js", "./dist/core-minimal.js", {
	name: `Eleventy (Build Awesome) v${pkg.version} (@11ty/client Bundle)`,
	moduleRoot: "../../",
	// No core-bundled plugins, reduced feature set
	adapterSuffixes: [".client.js", ".core.js", ".core.cjs"],
	external: ["node:fs", "node:crypto", "@sindresorhus/slugify"],
	esbuild: {
		keepNames: false,
		// minify: true
	},
});

console.log(`${PREFIX}Wrote dist/core-minimal.js: ${size("./dist/core-minimal.js")}`);

// Careful, this one is big!
await bundleClient("./src/BundleCoreFs.js", `./dist/core-fs.js`, {
	name: `Eleventy (Build Awesome) v${pkg.version} (@11ty/client/core-fs Bundle)`,
	moduleRoot: "../../",
	adapterSuffixes: [".core.js", ".core.cjs"],
	// Adds named export FileSystem for using the file system in other packages
	fileSystemMode: "publish",
});
console.log(`${PREFIX}Wrote dist/core-fs.js: ${size("./dist/core-fs.js")}`);

// fs.mkdirSync("./visualize/", { recursive: true });
// fs.writeFileSync("./visualize/meta.json", JSON.stringify(result.metafile));
// npx esbuild-visualizer --metadata ./packages/browser/visualize/meta.json --filename packages/browser/visualize/index.html

await bundleClient(import.meta.resolve("./src/BundleLiquid.js"), `./dist/formats/liquid.js`, {
	name: `Eleventy (Build Awesome) v${pkg.version} (@11ty/client/liquid Engine Bundle)`,
	moduleRoot: "../../",
	adapterSuffixes: [".core.js", ".core.cjs"],
});
console.log(`${PREFIX}Wrote dist/formats/liquid.js: ${size("./dist/formats/liquid.js")}`);

await bundleClient(import.meta.resolve("./src/BundleNunjucks.js"), `./dist/formats/nunjucks.js`, {
	name: `Eleventy (Build Awesome) v${pkg.version} (@11ty/client/njk Engine Bundle)`,
	moduleRoot: "../../",
});
console.log(`${PREFIX}Wrote dist/formats/nunjucks.js: ${size("./dist/formats/nunjucks.js")}`);

await bundleClient(import.meta.resolve("./src/BundleMarkdown.js"), `./dist/formats/markdown.js`, {
	name: `Eleventy (Build Awesome) v${pkg.version} (@11ty/client/md Engine Bundle)`,
	moduleRoot: "../../",
	adapterSuffixes: [".core.js", ".core.cjs"],
});
console.log(`${PREFIX}Wrote dist/formats/markdown.js: ${size("./dist/formats/markdown.js")}`);

await bundleClient(
	import.meta.resolve("./src/BundleI18nPlugin.js"),
	`./dist/plugins/plugin-i18n.js`,
	{
		name: `Eleventy (Build Awesome) v${pkg.version} (i18n Plugin)`,
		moduleRoot: "../../",
		adapterSuffixes: [".core.js", ".core.cjs"],
	},
);
console.log(`${PREFIX}Wrote dist/plugins/plugin-i18n.js: ${size("./dist/plugins/plugin-i18n.js")}`);
