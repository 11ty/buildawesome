import { getCode, getTarget } from "import-module-string";

// Runs module code as a function so `data` values are passed in as arguments (functions too), not serialized into the source
export async function importAsFunction(code, { filePath, data = {}, implicitExports = true } = {}) {
	let compiled = await getCode(code, { filePath, implicitExports, compileAsFunction: true });

	let target = await getTarget(compiled);
	let url = target instanceof Blob ? URL.createObjectURL(target) : target;
	try {
		let { default: fn } = await import(/* @vite-ignore */ url);
		return fn(data);
	} finally {
		if (target instanceof Blob) {
			URL.revokeObjectURL(url);
		}
	}
}
