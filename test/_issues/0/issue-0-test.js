import test from "ava";
import { fileURLToPath } from "node:url";
import { parse } from "node:path";
import { spawnAsync } from "../../../src/Util/spawn.js";

const CURRENT_DIR = parse(fileURLToPath(import.meta.url)).dir;

test.skip("Issue #0 (this is a stub file)", async (t) => {
	let result = await spawnAsync(
		"node",
		["../../../cmd.cjs", "--to=json"],
		{
			cwd: CURRENT_DIR,
		}
	);

	let json = JSON.parse(result);

	t.is(json.length, 1);
	t.is(json[0]?.content.trim(), "<p>HTML</p>");
});

