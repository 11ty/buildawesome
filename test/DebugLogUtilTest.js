import test from "ava";
import { execFileSync } from "node:child_process";
import { createDebug } from "../src/Util/DebugLogUtil.js";

test("Debug namespace uses a single colon", (t) => {
	t.is(createDebug("Benchmark").namespace, "Eleventy:Benchmark");
});

test("Debug namespace uses BuildAwesome prefix", (t) => {
	let namespace = execFileSync(
		process.execPath,
		[
			"--input-type=module",
			"-e",
			`import { createDebug } from "./src/Util/DebugLogUtil.js"; process.stdout.write(createDebug("Benchmark").namespace);`,
		],
		{ env: { ...process.env, BUILDAWESOME_PACKAGE: "@awesome.me/buildawesome" } },
	).toString();
	t.is(namespace, "BuildAwesome:Benchmark");
});
