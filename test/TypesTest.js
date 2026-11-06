import test from "node:test";
import assert from "node:assert";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const TS_PACKAGE_JSON = createRequire(import.meta.url).resolve("typescript/package.json");
const TSC = join(dirname(TS_PACKAGE_JSON), "bin/tsc");

test("Config files type-check against the published types", async () => {
	// Emit types without checking src (which has unrelated type errors)
	await exec(process.execPath, [TSC, "--noCheck"]);

	try {
		await exec(process.execPath, [TSC, "-p", "test/stubs-types/tsconfig.json"]);
	} catch (e) {
		assert.fail(e.stdout || e.message);
	}
});
