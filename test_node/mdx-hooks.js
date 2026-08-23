// mdx-hooks.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileSync } from "@mdx-js/mdx";

const extensions = [".md", ".mdx"];

export function load(url, context, nextLoad) {
	const parsed = new URL(url);
	if (parsed.protocol !== "file:" || !extensions.includes(path.extname(parsed.pathname))) {
		return nextLoad(url, context);
	}

	const filePath = fileURLToPath(url);
	const value = fs.readFileSync(filePath, "utf8");

	// Same CompileOptions you were passing to register() before
	const compiled = compileSync({ path: filePath, value });

	return {
		format: "module",
		shortCircuit: true,
		source: String(compiled),
	};
}
