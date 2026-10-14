import test from "ava";
import { GlobStripper } from "../src/Util/GlobStripper.js";

test("Separate globs from directories", (t) => {
  t.deepEqual(GlobStripper.parse(""), { path: "." });
  t.deepEqual(GlobStripper.parse("dir"), { path: "dir" });
  t.deepEqual(GlobStripper.parse("./*"), { path: ".", glob: "*" });
  t.deepEqual(GlobStripper.parse("*"), { path: ".", glob: "*" });
  t.deepEqual(GlobStripper.parse("**"), { path: ".", glob: "**" });
  t.deepEqual(GlobStripper.parse("**/*"), { path: ".", glob: "**/*" });
  t.deepEqual(GlobStripper.parse("*/*"), { path: ".", glob: "*/*" });
  t.deepEqual(GlobStripper.parse("**/**/*"), { path: ".", glob: "**/**/*" });
  t.deepEqual(GlobStripper.parse(".dot/**"), { path: ".dot", glob: "**" });
  t.deepEqual(GlobStripper.parse("dir/**"), { path: "dir", glob: "**" });
  t.deepEqual(GlobStripper.parse("/dir/**"), { path: "/dir", glob: "**" });
  t.deepEqual(GlobStripper.parse("dir/**/*"), { path: "dir", glob: "**/*" });
  t.deepEqual(GlobStripper.parse("dir/**/*.{jpg,png}"), { path: "dir", glob: "**/*.{jpg,png}" });
});

test("Star not at start of filename", (t) => {
  t.deepEqual(GlobStripper.parse("a*.c*"), { path: ".", glob: "a*.c*" });
  t.deepEqual(GlobStripper.parse("a/b-*/**/z.js"), { path: "a", glob: "b-*/**/z.js" });
});

test("Expected failures", (t) => {
  t.throws(() => GlobStripper.parse("?/?"), { message: "Could not automatically determine top-most folder from glob pattern: ?/?"});
});

test("Issue #3910", (t) => {
  t.deepEqual(GlobStripper.parse("./node_modules/artificial-chart/artificial-chart.css"), { path: "./node_modules/artificial-chart/artificial-chart.css" });
  t.deepEqual(GlobStripper.parse("./node_modules/artificial-chart/artificial-chart.{css,js}"), { path: "./node_modules/artificial-chart", glob: "artificial-chart.{css,js}" });
  t.deepEqual(GlobStripper.parse("./node_modules/artificial-chart/artificial-chart.(css|js)"), { path: "./node_modules/artificial-chart", glob: "artificial-chart.(css|js)" });
});
