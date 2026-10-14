import test from "ava";

import { spawnAsync } from "../src/Util/spawn.js";

test("#3854 parent directory for content, with global data files", async (t) => {
  let result = await spawnAsync(
		"node",
		["../../../../cmd.cjs", "--to=json"],
    {
      cwd: "test/_issues/3854/app/"
    }
	);

  let json = JSON.parse(result);
  t.is(json.length, 2);

  json.sort((a, b) => {
    return a.inputPath.length - b.inputPath.length;
  })

  t.is(json[0]?.content.trim(), "3854/parent");
  t.is(json[1]?.content.trim(), "3854/child");
});
