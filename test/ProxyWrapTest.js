import test from "ava";
import { ProxyWrap } from "../src/Util/Objects/ProxyWrap.js";

test("Basic wrap", (t) => {
  let test = ProxyWrap({}, { a: 1 });
  t.is(test.a, 1);
});

test("Nested wrap", (t) => {
  let test = ProxyWrap({}, { child: { a: 1, b: 1 } });
  t.truthy(test.child);
  t.deepEqual(test.child, { a: 1, b: 1 });
  t.deepEqual(test.child.a, 1);
  t.deepEqual(test.child.b, 1);
});

test("Double nested wrap", (t) => {
  let child = {
    a: 1,
    b: 1,
    c: {
      grandchild: 1,
    },
  };
  let test = ProxyWrap(
    {},
    {
      child,
    }
  );
  t.truthy(test.child);
  t.deepEqual(test.child, child);
  t.deepEqual(test.child.a, 1);
  t.deepEqual(test.child.b, 1);
  t.deepEqual(test.child.c.grandchild, 1);
});

test("Array", (t) => {
  let test = ProxyWrap({}, { child: [1, 2, 3] });
  t.deepEqual(test.child, [1, 2, 3]);
  t.deepEqual(test.child[1], 2);
});

test("Array nested", (t) => {
  let test = ProxyWrap({}, { child: [1, [2], 3] });
  t.deepEqual(test.child, [1, [2], 3]);
  t.deepEqual(test.child[1], [2]);
  t.deepEqual(test.child[1][0], 2);
});

test("Fails for invalid target", (t) => {
  t.throws(() => ProxyWrap(true, {}));
});

test("Fails for invalid fallback", (t) => {
  t.throws(() => ProxyWrap({}, true));
});

test("Frozen Object", (t) => {
  let test = ProxyWrap({}, Object.freeze({ eleventy: { generator: "Eleventy v3.0.0" } }));
  t.deepEqual(test.eleventy.generator, "Eleventy v3.0.0");
});


test("Frozen Nested Object", (t) => {
  let test = ProxyWrap({ eleventy: {} }, { eleventy: Object.freeze({ generator: "Eleventy v3.0.0" }) });
  t.deepEqual(test.eleventy.generator, "Eleventy v3.0.0");
});
