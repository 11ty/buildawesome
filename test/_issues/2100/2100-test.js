import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "node:path";
import { spawnAsync } from "../../../src/Util/spawn.js";

const CURRENT_DIR = parse(fileURLToPath(import.meta.url)).dir;

test("Issue #2100 renderTemplate md with a custom input directory", async (t) => {
	let result = await spawnAsync("node", ["../../../cmd.cjs", "--to=json"], {
		cwd: CURRENT_DIR,
	});

	let json = JSON.parse(result);

	t.assert.strictEqual(json.length, 1);
	t.assert.strictEqual(
		json[0]?.content.trim(),
		`<p>Hello World, and Ray</p>
<h1>I am a title</h1>
<ul>
<li>I am a list</li>
<li>I am a list</li>
</ul>

<ul>
<li>from an include</li>
</ul>`,
	);
});
