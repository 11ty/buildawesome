import test from "ava";
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
  t.is(output.join("\n").slice(0, expected.length), expected);
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
  t.is(output.join("\n").slice(0, expected.length), expected);
});
