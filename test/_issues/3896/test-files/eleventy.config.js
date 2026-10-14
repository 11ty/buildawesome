import path from "node:path";

export default function(cfg) {
  // Works
  // cfg.ignores.add("../**/_archive/**");

  cfg.ignores.add("**/_archive/**");
};

export const config = {
  dir: {
    input: path.resolve("../eleventy-input-folder"),
    output: path.resolve("../_site")
  }
}