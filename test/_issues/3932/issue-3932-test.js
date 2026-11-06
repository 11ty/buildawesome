import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "node:path";
import { spawnAsync } from "../../../src/Util/spawn.js";

const CURRENT_DIR = parse(fileURLToPath(import.meta.url)).dir;

test("Issue #3932", async (t) => {
	let result = await spawnAsync(
		"node",
		["../../../cmd.cjs", "--to=json"],
		{
			cwd: CURRENT_DIR,
		}
	);

	let json = JSON.parse(result);

	t.assert.strictEqual(json.length, 1);
	t.assert.strictEqual(json[0]?.inputPath.trim(), "./1/2025.html");
	t.assert.strictEqual(json[0]?.content.trim(), "/1/2025");
	t.assert.strictEqual(json[0]?.outputPath.trim(), "./_site/1/2025/index.html");
});

