import path from "node:path";

// Returns true if subfolder is in parent (accepts absolute or relative paths for both)
export default function (parentFolder, subFolder) {
	// path.resolve returns an absolute path
	if (path.resolve(subFolder).startsWith(path.resolve(parentFolder))) {
		return true;
	}
	return false;
}
