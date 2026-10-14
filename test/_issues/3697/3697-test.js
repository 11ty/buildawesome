// import path from "node:path";
// import { fileURLToPath } from "node:url";
import test from "ava";
import Eleventy from "../../../src/Core.js";

test("Number file names on global data files", async t => {
  // TODO fix absolute paths here
  // let dir = path.parse(fileURLToPath(import.meta.url)).dir;
  let dir = "./test/_issues/3697/";
  let elev = new Eleventy(dir, undefined, {
    config: function ($config) {
      $config.addTemplate("index.11ty.js", function(data) {
        return '' + JSON.stringify(data.folder);
      })
    },
  });

  let results = await elev.toJSON();
  t.is(results.length, 1);
  t.is(results[0].content, `[{"key":"value"},null,null,{}]`);
});
