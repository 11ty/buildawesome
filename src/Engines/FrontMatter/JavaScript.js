import { RetrieveGlobals } from "../../Util/RetrieveGlobals.js";

// `javascript` Front Matter Type
export default function (frontMatterCode, context = {}) {
	let { filePath, globals } = context;

	// Legacy `javascript` type was removed in @11ty/gray-matter@2 to avoid eval()
	let trimmed = frontMatterCode.trimStart();
	if (trimmed.startsWith("{")) {
		// Named, since `export default` isn’t supported when running as a function
		return RetrieveGlobals(`export const __frontMatterData = ${trimmed}`, filePath, {
			isJavaScriptFrontMatterCompat: true, // turns off implicit exports
			globals,
		}).then((res) => {
			return res.__frontMatterData;
		});
	}

	return RetrieveGlobals(frontMatterCode, filePath, { globals });
}
