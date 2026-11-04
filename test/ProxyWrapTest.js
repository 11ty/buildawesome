import test from "node:test";
import { ProxyWrap } from "../src/Util/Objects/ProxyWrap.js";

test("Basic wrap", (t) => {
  let test = ProxyWrap({}, { a: 1 });
  t.assert.strictEqual(test.a, 1);
});

test("Nested wrap", (t) => {
  let test = ProxyWrap({}, { child: { a: 1, b: 1 } });
  t.assert.ok(test.child);
  t.assert.deepStrictEqual(test.child, { a: 1, b: 1 });
  t.assert.deepStrictEqual(test.child.a, 1);
  t.assert.deepStrictEqual(test.child.b, 1);
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
  t.assert.ok(test.child);
  t.assert.deepStrictEqual(test.child, child);
  t.assert.deepStrictEqual(test.child.a, 1);
  t.assert.deepStrictEqual(test.child.b, 1);
  t.assert.deepStrictEqual(test.child.c.grandchild, 1);
});

test("Array", (t) => {
  let test = ProxyWrap({}, { child: [1, 2, 3] });
  t.assert.deepStrictEqual(test.child, [1, 2, 3]);
  t.assert.deepStrictEqual(test.child[1], 2);
});

test("Array nested", (t) => {
  let test = ProxyWrap({}, { child: [1, [2], 3] });
  t.assert.deepStrictEqual(test.child, [1, [2], 3]);
  t.assert.deepStrictEqual(test.child[1], [2]);
  t.assert.deepStrictEqual(test.child[1][0], 2);
});

test("Fails for invalid target", (t) => {
  t.assert.throws(() => ProxyWrap(true, {}));
});

test("Fails for invalid fallback", (t) => {
  t.assert.throws(() => ProxyWrap({}, true));
});

test("Frozen Object", (t) => {
  let test = ProxyWrap({}, Object.freeze({ eleventy: { generator: "Eleventy v3.0.0" } }));
  t.assert.deepStrictEqual(test.eleventy.generator, "Eleventy v3.0.0");
});


test("Frozen Nested Object", (t) => {
  let test = ProxyWrap({ eleventy: {} }, { eleventy: Object.freeze({ generator: "Eleventy v3.0.0" }) });
  t.assert.deepStrictEqual(test.eleventy.generator, "Eleventy v3.0.0");
});
