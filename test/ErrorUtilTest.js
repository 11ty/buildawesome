import test from "node:test";
import ErrorUtil from "../src/Errors/ErrorUtil.js";
import TemplateContentPrematureUseError from "../src/Errors/TemplateContentPrematureUseError.js";

const SAMPLE_ERROR = new Error("Nothing to see here");

const { cleanMessage, hasEmbeddedError, convertErrorToString, deconvertErrorToObject } =
  ErrorUtil;

test("hasEmbeddedError()", (t) => {
  t.assert.strictEqual(hasEmbeddedError(""), false);
  t.assert.strictEqual(hasEmbeddedError(convertErrorToString(SAMPLE_ERROR)), true);
});

test("cleanMessage()", (t) => {
  t.assert.strictEqual(cleanMessage(null), "");
  t.assert.strictEqual(cleanMessage(undefined), "");
  t.assert.strictEqual(cleanMessage(false), "");
  t.assert.strictEqual(cleanMessage(""), "");

  const text = "I am the very model of a sample text input";
  t.assert.strictEqual(cleanMessage(text), text);
  t.assert.strictEqual(cleanMessage(text + convertErrorToString(SAMPLE_ERROR)), text);
});

test("deconvertErrorToObject() should throw on invalid inputs", (t) => {
  t.assert.throws(() => deconvertErrorToObject(undefined), {
    message: "Could not convert error object from: undefined",
  });
  t.assert.throws(() => deconvertErrorToObject(""), {
    message: "Could not convert error object from: ",
  });
  t.assert.throws(() => deconvertErrorToObject("Not an error"), {
    message: "Could not convert error object from: Not an error",
  });
});

test("deconvertErrorToObject() should return its argument if it does not contain another error", (t) => {
  t.assert.strictEqual(deconvertErrorToObject(SAMPLE_ERROR), SAMPLE_ERROR);
});

test("deconvertErrorToObject() should get message and stack from convertErrorToString()", (t) => {
  const nestingError = new Error(
    "This error contains a sample error: " + convertErrorToString(SAMPLE_ERROR)
  );
  const result = deconvertErrorToObject(nestingError);
  t.assert.strictEqual(result.name, nestingError.name);
  t.assert.strictEqual(result.message, SAMPLE_ERROR.message);
  t.assert.strictEqual(result.stack, SAMPLE_ERROR.stack);
});

test("isPrematureTemplateContentError() follows nested Error.cause values", (t) => {
  let prematureError = new TemplateContentPrematureUseError("Too early");
  let error = new Error("Outer error", {
    cause: new Error("Inner error", { cause: prematureError }),
  });

  t.assert.strictEqual(ErrorUtil.isPrematureTemplateContentError(error), true);
});
