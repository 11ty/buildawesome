import test from "ava";
import ComputedData from "../src/Data/ComputedData.js";
import TemplateConfig from "../src/TemplateConfig.js";

test("Basic get/set", async (t) => {
  let cd = new ComputedData();

  cd.add("keystr", "this is a str");
  cd.add("key1", (data) => {
    return `this is a test ${data.key2}${data.keystr}`;
  });

  let data = {
    key2: "inject me",
  };
  await cd.setupData(data);

  t.is(data.key1, "this is a test inject methis is a str");
  t.is(data.key2, "inject me");
  t.is(data.keystr, "this is a str");
});

test("Basic get/set (reverse order of adds)", async (t) => {
  let cd = new ComputedData();

  cd.add("key1", (data) => {
    return `this is a test ${data.key2}${data.keystr}`;
  });
  cd.add("keystr", "this is a str");

  let data = {
    key2: "inject me",
  };
  await cd.setupData(data);

  t.is(data.key1, "this is a test inject methis is a str");
  t.is(data.key2, "inject me");
  t.is(data.keystr, "this is a str");
});

test("Basic get/set (reverse order of adds) nested two deep", async (t) => {
  let cd = new ComputedData();

  cd.add("key1.key3", (data) => {
    return `this is a test ${data.key2}${data.keystr}`;
  });
  cd.add("key1.key4", (data) => {
    return `this is a test ${data.key1.key3}`;
  });
  cd.add("keystr", "this is a str");

  let data = {
    key2: "inject me",
  };
  await cd.setupData(data);

  t.is(data.key1.key3, "this is a test inject methis is a str");
  t.is(data.key1.key4, "this is a test this is a test inject methis is a str");
  t.is(data.key2, "inject me");
  t.is(data.keystr, "this is a str");
});

test("use a computed value in another computed", async (t) => {
  let cd = new ComputedData();
  cd.add("keyComputed", (data) => {
    return `this is a test ${data.keyOriginal}`;
  });
  cd.add("keyComputed2nd", (data) => {
    return `using computed ${data.keyComputed}`;
  });

  let data = {
    keyOriginal: "inject me",
  };
  await cd.setupData(data);

  t.is(data.keyComputed2nd, "using computed this is a test inject me");
});

test("use a computed value in another computed (out of order)", async (t) => {
  let cd = new ComputedData();
  cd.add("keyComputed2nd", (data) => {
    return `using computed ${data.keyComputed}`;
  });
  cd.add("keyComputed", (data) => {
    return `this is a test ${data.keyOriginal}`;
  });

  let data = {
    keyOriginal: "inject me",
  };
  await cd.setupData(data);

  t.is(data.keyComputed2nd, "using computed this is a test inject me");
});

test("use a computed value in another computed (out of order), async callbacks", async (t) => {
  let cd = new ComputedData();
  cd.add("keyComputed2nd", async (data) => {
    // await in data.keyComputed is optional 👀
    return `using computed ${data.keyComputed}`;
  });
  cd.add("keyComputed", async (data) => {
    // await in data.keyOriginal is optional 👀
    return `this is a test ${await data.keyOriginal}`;
  });

  let data = {
    keyOriginal: "inject me",
  };
  await cd.setupData(data);

  t.is(data.keyComputed2nd, "using computed this is a test inject me");
});

test("Basic get/set nested", async (t) => {
  let cd = new ComputedData();

  cd.add("key1.nested", (data) => {
    return `${data.key2}`;
  });
  cd.add("key2", (data) => "hi");

  let data = {
    key2: "inject me",
  };
  await cd.setupData(data);

  t.deepEqual(data.key1, { nested: "hi" });
  t.is(data.key1.nested, "hi");
  t.is(data.key2, "hi");
});

test("Basic get/set nested deeper", async (t) => {
  let cd = new ComputedData();

  cd.add("key1.nested.deeperA", (data) => {
    return `${data.key2}`;
  });
  cd.add("key1.nested.deeperB", (data) => {
    return `${data.key2}`;
  });
  cd.add("key1.nested.deeperC.wow", (data) => {
    return `${data.key2}`;
  });
  cd.add("key2", (data) => "hi");

  let data = {
    key1: {
      nonComputed: "hi",
    },
    key2: "inject me",
  };
  await cd.setupData(data);

  t.deepEqual(data.key1, {
    nonComputed: "hi",
    nested: {
      deeperA: "hi",
      deeperB: "hi",
      deeperC: {
        wow: "hi",
      },
    },
  });

  t.is(data.key1.nested.deeperA, "hi");
  t.is(data.key1.nested.deeperB, "hi");
  t.is(data.key1.nested.deeperC.wow, "hi");
  t.is(data.key1.nonComputed, "hi");
  t.is(data.key2, "hi");
});

test("template string versus function types", async (t) => {
  let cd = new ComputedData();

  cd.add("key1.nested.deeperA", (data) => {
    return `${data.key2}`;
  });
  cd.add("key2", () => "hi");

  let data = {
    key1: {
      nonComputed: "hi",
    },
    key2: "inject me",
  };
  await cd.setupData(data);

  t.deepEqual(data.key1, {
    nonComputed: "hi",
    nested: {
      deeperA: "hi",
    },
  });
});

test("Basic get/set with template string", async (t) => {
  let cd = new ComputedData();

  cd.addTemplateString("keystr", "this is a str");
  cd.addTemplateString("key1", (data) => {
    return `this is a test ${data.key2}${data.keystr}`;
  });

  let data = {
    key2: "inject me",
  };
  await cd.setupData(data);

  t.is(data.key1, "this is a test inject methis is a str");
  t.is(data.key2, "inject me");
  t.is(data.keystr, "this is a str");
});

test("Basic get/set using array data", async (t) => {
  t.plan(4);
  let cd = new ComputedData();

  cd.add("keystr", "this is a str");
  cd.add("key1", (data) => {
    t.is(Array.isArray(data.arr), true);
    return `this is a test ${data.arr[0]}${data.keystr}`;
  });

  let data = {
    arr: ["inject me"],
    collections: {
      first: [],
      second: [],
    },
  };
  await cd.setupData(data);

  t.is(data.key1, "this is a test inject methis is a str");
  t.is(data.arr[0], "inject me");
  t.is(data.keystr, "this is a str");
});

test("Computed returns deep object", async (t) => {
  let cd = new ComputedData();

  cd.add("returnobj", (data) => {
    return {
      key1: "value1",
      nest: {
        key2: "value2",
      },
    };
  });

  let data = {
    returnobj: {
      key1: "bad1",
      nest: {
        key2: "bad2",
      },
    },
  };
  await cd.setupData(data);

  t.is(data.returnobj.key1, "value1");
  t.is(data.returnobj.nest.key2, "value2");
});

test("Boolean computed value Issue #1114", async (t) => {
  let cd = new ComputedData();

  cd.add("bool1", true);

  let data = {
    key2: "inject me",
  };
  await cd.setupData(data);

  t.is(data.bool1, true);
  t.is(data.key2, "inject me");
});

test("Reading an unavailable path stops the function and defers it", async (t) => {
  let runs = 0;
  let cd = new ComputedData();

  cd.add("key1", (data) => {
    runs++;
    return data.collections.first.length;
  });

  let data = {
    collections: {},
  };
  await cd.setupData(data, { unavailable: ["collections"] });
  t.is(runs, 1);
  t.false("key1" in data);

  data.collections.first = [1, 2];
  await cd.processRemainingData(data);
  t.is(runs, 2);
  t.is(data.key1, 2);
});

test("Swallowed reads of an unavailable path still defer", async (t) => {
  let cd = new ComputedData();

  cd.add("key1", (data) => {
    try {
      return data.page.rawInput.length;
    } catch (e) {
      return -1;
    }
  });

  let data = { page: {} };
  await cd.setupData(data, { unavailable: ["page.rawInput"] });
  t.false("key1" in data);
});

test("Enumerating a parent object reads its unavailable children", async (t) => {
  let cd = new ComputedData();

  cd.add("key1", (data) => JSON.stringify(data.page));

  let data = { page: { inputPath: "./in.md" } };
  await cd.setupData(data, { unavailable: ["page.rawInput"] });
  t.false("key1" in data);

  data.page.rawInput = "raw";
  await cd.processRemainingData(data);
  t.is(data.key1, `{"inputPath":"./in.md","rawInput":"raw"}`);
});

test("Template strings that use an unavailable path are deferred (placeholder rendering)", async (t) => {
  let cd = new ComputedData();

  cd.addTemplateString("key1", async (data) => `${data.collections.posts}`);

  let data = {};
  await cd.setupData(data, { unavailable: ["collections"] });
  t.false("key1" in data);
});

test("Template strings that use an unavailable path are deferred (symbol parsing)", async (t) => {
  let cd = new ComputedData();

  cd.addTemplateString("key1", async (data) => `${data.page.rawInput}`, [], () => ["page.rawInput"]);
  cd.addTemplateString("key2", async (data) => `${data.key1}!`, [], () => ["key1"]);

  let data = { page: {} };
  await cd.setupData(data, { unavailable: ["page.rawInput"] });
  t.false("key1" in data);
  t.false("key2" in data);

  data.page.rawInput = "raw";
  await cd.processRemainingData(data);
  t.is(data.key2, "raw!");
});

test("Inherits resolved signals from another data object", async (t) => {
  let runs = { a: 0, b: 0 };
  let parent = new ComputedData();
  parent.add("a", () => ++runs.a);
  parent.add("b", (data) => `${data.item}:${++runs.b}`);

  let parentData = {};
  await parent.setupData(parentData, { unavailable: ["item"] });
  t.is(parentData.a, 1);
  t.false("b" in parentData);

  let child = new ComputedData();
  child.add("a", () => ++runs.a);
  child.add("b", (data) => `${data.item}:${++runs.b}`);

  let childData = { ...parentData, item: "x" };
  child.inherit(childData, parent, parentData);
  await child.setupData(childData);

  t.is(childData.a, 1);
  t.is(runs.a, 1);
  t.is(childData.b, "x:1");
});

test("Expect collections to be arrays in data callback #1114", async (t) => {
  t.plan(2);
  let cd = new ComputedData();

  cd.add("key1", (data) => {
    if (data.collections.first.length) {
      t.is(data.collections.first[0], 1);
      t.is(data.collections.second[0], 2);
    }
    return ``;
  });

  let data = {
    collections: {
      first: [1],
      second: [2],
    },
  };
  await cd.setupData(data);
});

test("Tracks dependencies", async (t) => {
  let cd = new ComputedData();

  cd.add("key1", (data) => data.collections.all);
  cd.add("key2", (data) => data.key1 + data.key3);
  cd.add("key3", (data) => "");

  let data = {
    collections: {
      all: [1],
    },
  };

  await cd.setupData(data);
  t.deepEqual(cd.getDependencies("key1", data), []);
  t.deepEqual(cd.getDependencies("key2", data), ["key1", "key3"]);
  t.deepEqual(cd.getDependencies("key3", data), []);
});

test("Process in two stages (deferring collections)", async (t) => {
  let cd = new ComputedData();

  cd.add("page.url", (data) => data.key2);
  cd.add("page.outputPath", (data) => data.key2);
  cd.add("key0", (data) => "hi");
  cd.add("key1", (data) => data.collections.dog[0]);
  cd.add("key3", (data) => data.key1 + 1);
  cd.add("collections.processed", (data) => "hi");

  let data = {
    key2: "/my-path/",
    collections: {
      dog: [2],
    },
  };

  await cd.setupData(data, { unavailable: ["collections"] });

  t.deepEqual(data, {
    collections: {
      dog: [2],
    },
    key0: "hi",
    key2: "/my-path/",
    page: {
      url: "/my-path/",
      outputPath: "/my-path/",
    },
  });

  await cd.processRemainingData(data);

  t.deepEqual(data, {
    collections: {
      dog: [2],
      processed: "hi",
    },
    key0: "hi",
    key1: 2,
    key2: "/my-path/",
    key3: 3,
    page: {
      url: "/my-path/",
      outputPath: "/my-path/",
    },
  });
});

test("Circular dependencies throw", async (t) => {
  let cd = new ComputedData();

  cd.add("a", (data) => data.b);
  cd.add("b", (data) => data.a);

  await t.throwsAsync(() => cd.setupData({}), {
    message: "Circular computed data dependency: a -> b -> a",
  });
});

test("Circular dependencies throw (template strings, symbol parsing)", async (t) => {
  let cd = new ComputedData();

  cd.addTemplateString("a", async (data) => `${data.b}`, [], () => ["b"]);
  cd.addTemplateString("b", async (data) => `${data.a}`, [], () => ["a"]);

  await t.throwsAsync(() => cd.setupData({}), {
    message: "Circular computed data dependency: a -> b -> a",
  });
});

test("Circular dependencies throw (template strings, placeholder rendering)", async (t) => {
  let cd = new ComputedData();

  cd.addTemplateString("a", async (data) => `${data.b}`);
  cd.addTemplateString("b", async (data) => `${data.a}`);

  await t.throwsAsync(() => cd.setupData({}), {
    message: "Circular computed data dependency: a -> b -> a",
  });
});

test("Circular dependencies throw (function and template string)", async (t) => {
  let cd = new ComputedData();

  cd.add("a", (data) => data.b);
  cd.addTemplateString("b", async (data) => `${data.a}`, [], () => ["a"]);

  await t.throwsAsync(() => cd.setupData({}), {
    message: "Circular computed data dependency: a -> b -> a",
  });
});

test("Template string reads its own upstream value", async (t) => {
  let cd = new ComputedData();

  cd.addTemplateString("title", async (data) => `(${data.title})`, [], () => ["title"]);

  let data = { title: "hi" };
  await cd.setupData(data);
  t.is(data.title, "(hi)");
});

test("Reads its own upstream value", async (t) => {
  let cd = new ComputedData();

  cd.add("title", (data) => `(${data.title})`);

  let data = { title: "hi" };
  await cd.setupData(data);
  t.is(data.title, "(hi)");
});

test("Swallowed reads of pending computed data still re-run", async (t) => {
  let cd = new ComputedData();

  cd.add("a", (data) => {
    try {
      return data.b.toUpperCase();
    } catch (e) {
      return "fallback";
    }
  });
  cd.add("b", () => "b");

  let data = {};
  await cd.setupData(data);
  t.is(data.a, "B");
});

test("Reads nested computed data through a parent object", async (t) => {
  let cd = new ComputedData();

  cd.add("summary", (data) => JSON.stringify(data.page));
  cd.add("page.url", (data) => "/url/");

  let data = { page: { inputPath: "./in.md" } };
  await cd.setupData(data);
  t.is(data.summary, `{"inputPath":"./in.md","url":"/url/"}`);
});

test("Use JavaScript functions (filters) in computed data functions", async (t) => {
  let eleventyCfg = new TemplateConfig();
  await eleventyCfg.init();

  let cfg = eleventyCfg.getConfig();
  cfg.javascriptFunctions.alwaysBlue = function (str) {
    return str + " is blue";
  };
  let cd = new ComputedData(cfg);

  cd.add("key1", function (data) {
    return this.alwaysBlue("this is a test");
  });

  let data = {};
  await cd.setupData(data);

  t.is(data.key1, "this is a test is blue");
});
