import { RetrieveGlobals } from "../../Util/RetrieveGlobals.js";

// `javascript` Front Matter Type
export default function (frontMatterCode, context = {}) {
	let { filePath } = context;

	// Legacy `javascript` type was removed in @11ty/gray-matter@2 to avoid eval()
	let trimmed = frontMatterCode.trimStart();
	if (trimmed.startsWith("{")) {
		return RetrieveGlobals(`export default ${trimmed}`, filePath, {
			isJavaScriptFrontMatterCompat: true, // turns off implicit exports
		}).then((res) => {
			return res.default;
		});
	}

	return RetrieveGlobals(frontMatterCode, filePath);
}
