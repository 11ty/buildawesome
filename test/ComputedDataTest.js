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
  t.plan(5);
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

test("Expect even missing collections to be arrays in data callback #1114", async (t) => {
  t.plan(2);
  let cd = new ComputedData();

  cd.add("key1", (data) => {
    t.is(Array.isArray(data.collections.first), true);
    t.is(Array.isArray(data.collections.second), true);
    return ``;
  });

  let data = {
    collections: {},
  };
  await cd.resolveVarOrder(data);
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

test("Get var order", async (t) => {
  let cd = new ComputedData();

  cd.add("key1", (data) => data.collections.all);
  cd.add("key2", (data) => data.collections.dog);
  cd.add("key0", (data) => "");

  let data = {
    key2: "inject me",
    collections: {
      all: [1],
      dog: [2],
    },
  };

  await cd.resolveVarOrder(data);
  t.deepEqual(cd.queue.getOrder(), ["collections.all", "key1", "collections.dog", "key2", "key0"]);
});

test("Get var order and process it in two stages", async (t) => {
  let cd = new ComputedData();

  cd.add("page.url", (data) => data.key2);
  cd.add("page.outputPath", (data) => data.key2);
  cd.add("key0", (data) => "hi");
  cd.add("key1", (data) => data.collections.dog[0]);
  cd.add("collections.processed", (data) => "hi");

  let data = {
    key2: "/my-path/",
    collections: {
      dog: [2],
    },
  };

  // set page.url, page.outputPath, key2, collections.dog[0]
  await cd.setupData(data, function (entry) {
    // TODO see note in Template.js about changing the two pass computed data
    return !this.isUsesStartsWith(entry, "collections.");
  });

  t.deepEqual(data, {
    collections: {
      dog: [2],
      processed: "",
    },
    key0: "hi",
    key1: "",
    key2: "/my-path/",
    page: {
      url: "/my-path/",
      outputPath: "/my-path/",
    },
  });

  // set collections.processed
  await cd.setupData(data);

  t.deepEqual(data, {
    collections: {
      dog: [2],
      processed: "hi",
    },
    key0: "hi",
    key1: 2,
    key2: "/my-path/",
    page: {
      url: "/my-path/",
      outputPath: "/my-path/",
    },
  });

  // t.deepEqual(cd.queue.getOrder(), ["collections.all", "key1", "collections.dog", "key2", "key0"]);
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
