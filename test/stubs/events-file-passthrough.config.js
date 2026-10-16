export default function (eleventyConfig) {
	eleventyConfig.addPassthroughCopy("test/stubs/events-file-passthrough/robots.txt");
	eleventyConfig.addPassthroughCopy({ "test/stubs/events-file-passthrough/img": "img" });
}
