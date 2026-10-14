import test from "ava";
import Eleventy from "../src/Core.js";

async function captureLogs(callback) {
  let logs = [];
  let original = console.log;
  console.log = (...args) => logs.push(args);
  try {
    let results = await callback();
    // Async logs resolve after the filter returns
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { results, logs };
  } finally {
    console.log = original;
  }
}

test.serial("log filter (sync, njk)", async (t) => {
  let { results, logs } = await captureLogs(() => {
    let elev = new Eleventy("test/noop", false, {
      config($config) {
        $config.addTemplate("index.njk", `{{ "a" | log("b") }}`);
      },
    });
    return elev.toJSON();
  });

  t.is(results[0].content, "a");
  t.deepEqual(logs, [["a", "b"]]);
});

test.serial("log filter with promises returns input unchanged (11ty.js)", async (t) => {
  let input = Promise.resolve("a");
  let { results, logs } = await captureLogs(() => {
    let elev = new Eleventy("test/noop", false, {
      config($config) {
        $config.addTemplate("index.11ty.js", {
          async render() {
            let ret = this.log(input, Promise.resolve("b"), "c");
            t.is(ret, input);
            return ret;
          },
        });
      },
    });
    return elev.toJSON();
  });

  t.is(results[0].content, "a");
  t.deepEqual(logs, [["a", "b", "c"]]);
});

test.serial("log filter ignores rejected promises", async (t) => {
  let { results, logs } = await captureLogs(() => {
    let elev = new Eleventy("test/noop", false, {
      config($config) {
        $config.addTemplate("index.11ty.js", {
          render() {
            this.log("a", Promise.reject(new Error("nope")));
            return "a";
          },
        });
      },
    });
    return elev.toJSON();
  });

  t.is(results[0].content, "a");
  t.deepEqual(logs, []);
});
