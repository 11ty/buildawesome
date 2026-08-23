import test from "ava";
import ErrorUtil from "../src/Errors/ErrorUtil.js";

const SAMPLE_ERROR = new Error("Nothing to see here");

const { cleanMessage, hasEmbeddedError, convertErrorToString, deconvertErrorToObject } =
  ErrorUtil;

test("hasEmbeddedError()", (t) => {
  t.false(hasEmbeddedError(""));
  t.true(hasEmbeddedError(convertErrorToString(SAMPLE_ERROR)));
});

test("cleanMessage()", (t) => {
  t.is(cleanMessage(null), "");
  t.is(cleanMessage(undefined), "");
  t.is(cleanMessage(false), "");
  t.is(cleanMessage(""), "");

  const text = "I am the very model of a sample text input";
  t.is(cleanMessage(text), text);
  t.is(cleanMessage(text + convertErrorToString(SAMPLE_ERROR)), text);
});

test("deconvertErrorToObject() should throw on invalid inputs", (t) => {
  t.throws(() => deconvertErrorToObject(undefined), {
    message: "Could not convert error object from: undefined",
  });
  t.throws(() => deconvertErrorToObject(""), {
    message: "Could not convert error object from: ",
  });
  t.throws(() => deconvertErrorToObject("Not an error"), {
    message: "Could not convert error object from: Not an error",
  });
});

test("deconvertErrorToObject() should return its argument if it does not contain another error", (t) => {
  t.is(deconvertErrorToObject(SAMPLE_ERROR), SAMPLE_ERROR);
});

test("deconvertErrorToObject() should get message and stack from convertErrorToString()", (t) => {
  const nestingError = new Error(
    "This error contains a sample error: " + convertErrorToString(SAMPLE_ERROR)
  );
  const result = deconvertErrorToObject(nestingError);
  t.is(result.name, nestingError.name);
  t.is(result.message, SAMPLE_ERROR.message);
  t.is(result.stack, SAMPLE_ERROR.stack);
});
