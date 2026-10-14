export function union(...sets) {
	let root = new Set();
	for (let set of sets) {
		for (let entry of set) {
			root.add(entry);
		}
	}
	return root;
}
