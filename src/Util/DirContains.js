import path from "node:path";

// Returns true if subfolder is in parent (accepts absolute or relative paths for both)
export default function (parentFolder, subFolder) {
	let relative = path.relative(path.resolve(parentFolder), path.resolve(subFolder));

	// An absolute result means a different root (e.g. another Windows drive).
	return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
