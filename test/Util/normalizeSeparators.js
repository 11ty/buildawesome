import PathNormalizer from "../../src/Util/PathNormalizer.js";

export function normalizeSeparatorString(str) {
  return PathNormalizer.normalizeSeperator(str);
}

export function normalizeSeparatorArray(arr) {
  return arr.map(entry => {
    return PathNormalizer.normalizeSeperator(entry);
  })
}
