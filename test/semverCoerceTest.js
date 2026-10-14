import test from "ava";
import { coerce } from "../src/Util/SemverCoerce.js";

test("semverCoerce", t => {
  t.is(coerce("4.0.0"), "4.0.0");
  t.is(coerce("4.0.0-prerelease"), "4.0.0");
  t.is(coerce("4.0"), "4.0");
  t.is(coerce("v4.0"), "4.0");
});
