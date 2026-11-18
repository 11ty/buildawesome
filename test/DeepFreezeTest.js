import test from "node:test";
import { DeepFreeze } from "../src/Util/Objects/DeepFreeze.js";

test("DeepFreeze freezes nested plain objects", (t) => {
  let obj = DeepFreeze({ a: { b: {} } });
  t.assert.ok(Object.isFrozen(obj));
  t.assert.ok(Object.isFrozen(obj.a));
  t.assert.ok(Object.isFrozen(obj.a.b));
});

test("DeepFreeze skips top level exceptions", (t) => {
  let obj = DeepFreeze({ a: {}, b: {} }, ["a"]);
  t.assert.ok(Object.isFrozen(obj));
  t.assert.ok(!Object.isFrozen(obj.a));
  t.assert.ok(Object.isFrozen(obj.b));
});
