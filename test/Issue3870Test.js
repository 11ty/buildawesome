import test from "ava";
import Eleventy from "../src/Core.js";

// This tests Eleventy Watch WITHOUT using the file system!

test("#3870 templateRender has not yet initialized (not incremental)", async (t) => {
  let runs = [
    {
      expected: `[]`,
    },
    {
      expected: `[]`,
    },
  ];

  t.plan(runs.length + 1);

  let index = 0;
  let elev = new Eleventy("test/stubs-virtual/", "test/stubs-virtual/_site", {
    configPath: "test/stubs-virtual/eleventy.config.js",
    config($config) {
      $config.addTemplate("search.11ty.js", class {
        data() {
          return {
            permalink: '/search.json',
            // permalink: false,
            layout: false,
            eleventyExcludeFromCollections: true,
          };
        }

        async render(data) {
          return '[]';
        }
      });

      $config.on("buildawesome.after", ({ results }) => {
        t.is(results[0]?.content, runs[index].expected);
      });
    }
  });

  elev.disableLogger();
  await elev.init();

  await elev.watch();

  for(let run of runs) {
    await elev.triggerWatchRunForPath("test/stubs-virtual/eleventy.config.js");
    index++;
  }

  await elev.stopWatch();
});
