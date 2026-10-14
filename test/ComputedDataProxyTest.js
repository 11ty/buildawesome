import test from "ava";
import ComputedDataProxy from "../src/Data/ComputedDataProxy.js";

test("Get vars used by function", async (t) => {
  let cd = new ComputedDataProxy(["key1"]);
  let key1Fn = () => {};
  let key2Fn = (data) => {
    return `${data.key1}`;
  };

  t.deepEqual(await cd.findVarsUsed(key1Fn), []);
  t.deepEqual(await cd.findVarsUsed(key2Fn), ["key1"]);
});

test("Get vars used by function (not a computed key)", async (t) => {
  let cd = new ComputedDataProxy(["page.url"]);
  let key1Fn = (data) => {
    return `${data.page.url}`;
  };

  t.deepEqual(
    await cd.findVarsUsed(key1Fn, {
      page: { url: "" },
    }),
    ["page.url"]
  );
});

test("Get vars used by function (multiple functions—not computed keys)", async (t) => {
  let cd = new ComputedDataProxy([
    "page.url",
    "key1",
    "very.deep.reference",
    "very.other.deep.reference",
  ]);

  // this would be real
  let sampleData = {
    key1: "",
    page: {
      url: "",
    },
    very: {
      deep: {
        reference: "",
      },
      other: {
        deep: {
          reference: "",
        },
      },
    },
  };

  let key1Fn = (data) => {
    return `${data.page.url}`;
  };
  let key2Fn = (data) => {
    return `${data.key1}${data.very.deep.reference}${data.very.other.deep.reference}`;
  };

  t.deepEqual(await cd.findVarsUsed(key1Fn, sampleData), ["page.url"]);
  t.deepEqual(await cd.findVarsUsed(key2Fn, sampleData), [
    "key1",
    "very.deep.reference",
    "very.other.deep.reference",
  ]);
});

test("Proxy shouldn’t always return {}", async (t) => {
  let cd = new ComputedDataProxy(["page.fileSlug"]);
  let proxy = cd.getProxyData(
    {
      page: {
        fileSlug: "",
      },
    },
    new Set()
  );

  t.notDeepEqual(proxy.page.fileSlug, {});
  t.is(proxy.page.fileSlug, "");
});

test("isArrayOrPlainObject", async (t) => {
  let cd = new ComputedDataProxy();

  t.is(cd.isArrayOrPlainObject(true), false);
  t.is(cd.isArrayOrPlainObject(false), false);
  t.is(cd.isArrayOrPlainObject(1), false);
  t.is(
    cd.isArrayOrPlainObject(() => {}),
    false
  );
  t.is(
    cd.isArrayOrPlainObject(function () {}),
    false
  );
  t.is(cd.isArrayOrPlainObject(new Date()), false);
  t.is(cd.isArrayOrPlainObject({}), true);
  t.is(cd.isArrayOrPlainObject([]), true);
});

test("findVarsUsed empty", async (t) => {
  let cdg = new ComputedDataProxy();
  t.deepEqual(await cdg.findVarsUsed(() => {}), []);
  t.deepEqual(await cdg.findVarsUsed(({}) => {}), []);

  let data = { key: "value" };
  t.deepEqual(await cdg.findVarsUsed((data) => {}), []);
  t.deepEqual(await cdg.findVarsUsed((data) => data.key), ["key"]);
});

test("findVarsUsed with a computed key (target a string)", async (t) => {
  let cdg = new ComputedDataProxy();
  let data = {
    key: "value",
    computed: {
      key: function (data) {
        return data.key;
      },
    },
  };

  t.deepEqual(await cdg.findVarsUsed(data.computed.key, data), ["key"]);
});

test("findVarsUsed with a computed key (target an array)", async (t) => {
  let cdg = new ComputedDataProxy();
  let data = {
    arr: [0, 1, 2],
    computed: {
      key: function (data) {
        return data.arr[1];
      },
    },
  };

  t.deepEqual(await cdg.findVarsUsed(data.computed.key, data), ["arr[1]"]);
});

test("findVarsUsed with a computed key (target an object)", async (t) => {
  let cdg = new ComputedDataProxy();
  let data = {
    obj: {
      b: 1,
    },
    computed: {
      key: function (data) {
        return data.obj.b;
      },
    },
  };

  t.deepEqual(await cdg.findVarsUsed(data.computed.key, data), ["obj.b"]);
});

test("findVarsUsed with a computed key (target an object in an array)", async (t) => {
  let cdg = new ComputedDataProxy();
  let data = {
    obj: [{ b: 1 }, { a: 2 }],
    computed: {
      key: function (data) {
        return data.obj[1].a;
      },
    },
  };

  t.deepEqual(await cdg.findVarsUsed(data.computed.key, data), ["obj[1].a"]);
});

test("findVarsUsed with a computed key (target a string not used in the output)", async (t) => {
  let cdg = new ComputedDataProxy();
  let data = {
    key1: "value1",
    key2: "value2",
    computed: {
      key: function (data) {
        let b = data.key2;
        return data.key1;
      },
    },
  };

  t.deepEqual(await cdg.findVarsUsed(data.computed.key, data), ["key2", "key1"]);
});

test("findVarsUsed with a deep computed reference that doesn’t exist in parent data", async (t) => {
  let cdg = new ComputedDataProxy(["deep.deep1", "deep.deep2"]);
  let data = {
    key1: "value1",
    key2: "value2",
    computed: {
      deep: {
        deep1: function (data) {
          return data.key2;
        },
        deep2: function (data) {
          return data.deep.deep1;
        },
      },
    },
  };

  t.deepEqual(await cdg.findVarsUsed(data.computed.deep.deep2, data), ["deep.deep1"]);
  t.deepEqual(await cdg.findVarsUsed(data.computed.deep.deep1, data), ["key2"]);
});

test("findVarsUsed with a array should filter out array methods", async (t) => {
  let cdg = new ComputedDataProxy();
  let data = {
    arr: [0, 1, 2],
    computed: {
      key: function (data) {
        return data.arr.filter((entry) => entry === 2);
      },
    },
  };

  t.deepEqual(await cdg.findVarsUsed(data.computed.key, data), ["arr"]);
});

test("findVarsUsed with a array can still reference length", async (t) => {
  let cdg = new ComputedDataProxy();
  let data = {
    arr: [0, 1, 2],
    computed: {
      key: function (data) {
        return data.arr.length;
      },
    },
  };

  t.deepEqual(await cdg.findVarsUsed(data.computed.key, data), ["arr"]);
});

test("findVarsUsed can work with empty arrays", async (t) => {
  let cdg = new ComputedDataProxy();
  let data = {
    arr: [],
    computed: {
      key: function (data) {
        return data.arr;
      },
    },
  };

  t.deepEqual(await cdg.findVarsUsed(data.computed.key, data), ["arr"]);
});
