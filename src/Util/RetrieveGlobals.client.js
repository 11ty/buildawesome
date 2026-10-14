export async function RetrieveGlobals(code, filePath) {
	let target = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
	return import(/* @vite-ignore */ target).then((result) => {
		if (Object.keys(result).length === 0) {
			console.warn(
				`Arbitrary JavaScript front matter expects the use of \`export\` when used with the \`@11ty/client\` bundle (${filePath}). Add export or swap to use the \`@11ty/client/eleventy\` bundle instead.`,
			);
		}
		return result;
	});
}
