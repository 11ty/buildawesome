// Surgical JSON editing: `modify()` returns character-range edits so untouched bytes stay byte-identical.
export { parseTree, findNodeAtLocation, getNodeValue, modify, applyEdits } from "jsonc-parser";
