import test from "ava";
import { TemplatePath } from "@11ty/eleventy-utils";

import { spawnAsync } from "../../../../src/Util/spawn.js";

test("#3896 ignores should respect relative parent directory ../", async (t) => {
  let result = await spawnAsync(
		"node",
		["../../../../cmd.cjs", "--to=json"],
    {
      cwd: "test/_issues/3896/test-files/"
    }
	);

  let json = JSON.parse(result);

  t.is(json.length, 1);
  t.is(json[0]?.outputPath, TemplatePath.standardizeFilePath("../_site/3896/index.html"));
  t.is(json[0]?.content.trim(), "Issue 3896");
});

