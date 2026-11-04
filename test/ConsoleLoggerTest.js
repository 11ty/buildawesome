import test from "node:test";
import ConsoleLogger from "../src/Util/ConsoleLogger.js";

test("Disable chalk", (t) => {
  let cl = new ConsoleLogger();
  cl.isChalkEnabled = false;
  t.assert.strictEqual(cl.isChalkEnabled, false);
});

test("Re-enable chalk", (t) => {
  let cl = new ConsoleLogger();
  cl.isChalkEnabled = false;
  cl.isChalkEnabled = true;
  t.assert.strictEqual(cl.isChalkEnabled, true);
});

test("Message styles", (t) => {
  let cl = new ConsoleLogger();
  let logged;
  cl.message = (msg, type, color, forceToConsole) =>
    (logged = { msg, type, color, forceToConsole });

  cl.log("test");
  t.assert.deepStrictEqual(logged, {
    msg: "test",
    type: undefined,
    color: undefined,
    forceToConsole: undefined,
  });

  cl.forceLog("test");
  t.assert.deepStrictEqual(logged, {
    msg: "test",
    type: undefined,
    color: undefined,
    forceToConsole: true,
  });

  cl.info("test");
  t.assert.deepStrictEqual(logged, {
    msg: "test",
    type: "log",
    color: "blue",
    forceToConsole: undefined,
  });

  cl.warn("test");
  t.assert.deepStrictEqual(logged, {
    msg: "test",
    type: "warn",
    color: "yellow",
    forceToConsole: undefined,
  });

  cl.error("test");
  t.assert.deepStrictEqual(logged, {
    msg: "test",
    type: "error",
    color: "red",
    forceToConsole: undefined,
  });
});
