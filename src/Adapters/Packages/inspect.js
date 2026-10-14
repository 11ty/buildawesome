import { inspect as nodeInspect } from "node:util";

export function inspect(target) {
	return nodeInspect(target, { showHidden: false, depth: null });
}
