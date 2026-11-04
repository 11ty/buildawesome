import test from "node:test";
import ComputedDataTemplateString from "../src/Data/ComputedDataTemplateString.js";

test("Get fake proxy data", (t) => {
  let cd = new ComputedDataTemplateString(["key1", "key2"]);
  t.assert.deepStrictEqual(cd.getProxyData(), {
    key1: `${cd.prefix}key1${cd.suffix}`,
    key2: `${cd.prefix}key2${cd.suffix}`,
  });
});

test("Get nested fake proxy data", (t) => {
  let cd = new ComputedDataTemplateString(["key1.nested", "key2"]);
  t.assert.deepStrictEqual(cd.getProxyData(), {
    key1: {
      nested: `${cd.prefix}key1.nested${cd.suffix}`,
    },
    key2: `${cd.prefix}key2${cd.suffix}`,
  });
});

test("Get vars from output", (t) => {
  let cd = new ComputedDataTemplateString();
  t.assert.deepStrictEqual(cd.findVarsInOutput(""), []);
  t.assert.deepStrictEqual(cd.findVarsInOutput("slkdjfkljdsf"), []);
  t.assert.deepStrictEqual(cd.findVarsInOutput(`slkdjfkljdsf${cd.prefix}${cd.suffix}sldkjflkds`), []);
  t.assert.deepStrictEqual(cd.findVarsInOutput(`slkdjfkljdsf${cd.prefix}firstVar${cd.suffix}sldkjflkds`), [
    "firstVar",
  ]);
  t.assert.deepStrictEqual(
    cd.findVarsInOutput(
      `slkdjfkljdsf${cd.prefix}firstVar${cd.suffix}test${cd.prefix}firstVar${cd.suffix}sldkjflkds`
    ),
    ["firstVar"]
  );
  t.assert.deepStrictEqual(
    cd.findVarsInOutput(
      `slkdjfkljdsf${cd.prefix}firstVar${cd.suffix}test${cd.prefix}secondVar${cd.suffix}sldkjflkds`
    ),
    ["firstVar", "secondVar"]
  );
});
