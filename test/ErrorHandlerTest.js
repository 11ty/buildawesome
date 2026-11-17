import test from "node:test";
import { ErrorHandler } from "../src/Errors/ErrorHandler.js";

test("Log a warning, warning", (t) => {
  let errorHandler = new ErrorHandler();
  let output = [];
  errorHandler.logger = {
    log: function (str) {
      output.push(str);
    },
    warn: function (str) {
      output.push(str);
    },
    error: function (str) {
      output.push(str);
    },
    message: function (str) {
      output.push(str);
    },
  };
  errorHandler.warn(new Error("Test warning"), "Hello");

  let expected = "Hello:";
  t.assert.strictEqual(output.join("\n").slice(0, expected.length), expected);
});

test("Log a warning, error", (t) => {
  let errorHandler = new ErrorHandler();

  let output = [];
  errorHandler.logger = {
    log: function (str) {
      output.push(str);
    },
    warn: function (str) {
      output.push(str);
    },
    error: function (str) {
      output.push(str);
    },
    message: function (str) {
      output.push(str);
    },
  };

  errorHandler.error(new Error("Test error"), "It’s me");

  let expected = `It’s me:
Test error

Original error stack trace: Error: Test error`;
  t.assert.strictEqual(output.join("\n").slice(0, expected.length), expected);
});

test("Log an error wrapped via top-level `cause`", (t) => {
  let errorHandler = new ErrorHandler();
  let output = [];
  errorHandler.logger = {
    log: (str) => output.push(str),
    warn: (str) => output.push(str),
    error: (str) => output.push(str),
    message: (str) => output.push(str),
  };

  let original = new TypeError("Original message");
  errorHandler.error(new Error("Wrapper message", { cause: original }), "Hello");

  let str = output.join("\n");
  t.assert.strictEqual(str.includes("1. Wrapper message"), true);
  t.assert.strictEqual(str.includes("2. Original message (via TypeError)"), true);
  t.assert.strictEqual(str.includes("Original error stack trace: TypeError: Original message"), true);
});

test("Deferred errors log once on flush, after other output", (t) => {
  let errorHandler = new ErrorHandler();
  let output = [];
  errorHandler.logger = {
    message: (str) => output.push(str),
  };

  errorHandler.deferErrors();

  let error = new Error("Deferred error");
  errorHandler.once("error", error, "First");
  errorHandler.error(error, "Second");
  errorHandler.warn(new Error("Inline warning"), "Warning");
  t.assert.strictEqual(output.length, 1);
  t.assert.strictEqual(output[0].startsWith("Warning:"), true);

  errorHandler.flushErrors();
  t.assert.strictEqual(output.length, 2);
  t.assert.strictEqual(output[1].startsWith("First:\nDeferred error"), true);

  // No longer deferred after a flush
  errorHandler.error(new Error("Later error"), "Later");
  t.assert.strictEqual(output.length, 3);
});
