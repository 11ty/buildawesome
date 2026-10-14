// Standard
export default async function () {
	return import("../defaultConfig.js").then((mod) => mod.default);
}
