import test from "ava";

import { spawnAsync } from "../src/Util/spawn.js";

test("#3809 parent directory for content, with global data files", async (t) => {
  let result = await spawnAsync(
		"node",
		// Formats https://www.git-scm.com/docs/git-log#_pretty_formats
		// %at author date, UNIX timestamp
		["../../../../cmd.cjs", "--to=json"],
    {
      cwd: "test/_issues/3809/.app/"
    }
	);

  let json = JSON.parse(result);
  t.is(json.length, 1);
  t.is(json[0]?.content.trim(), "My Application");
});
