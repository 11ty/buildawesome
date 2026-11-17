import test from "node:test";
import Eleventy from "../src/Core.js";

function captureWarnings(elev) {
	let warnings = [];
	elev.setIsVerbose(true);
	elev.logger.overrideLogger({
		log() {},
		info() {},
		error() {},
		warn(message) {
			warnings.push(message);
		},
	});
	return warnings;
}

test(`#2462 tagCaseCollisions: "warn" warns when tags differ only by case`, async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.configureErrorReporting({ tagCaseCollisions: "warn" });
			eleventyConfig.addTemplate("one.md", "One", { tags: ["JavaScript"] });
			eleventyConfig.addTemplate("two.md", "Two", { tags: ["javascript", "css"] });
			eleventyConfig.addTemplate("three.md", "Three", { tags: ["CSS ", "html"] });
		},
	});
	let warnings = captureWarnings(elev);

	await elev.toJSON();
	t.assert.strictEqual(warnings.length, 2);
	t.assert.ok(warnings[0].includes("`JavaScript` (./test/noop/one.md)"));
	t.assert.ok(warnings[0].includes("`javascript` (./test/noop/two.md)"));
	t.assert.ok(warnings[1].includes("`css` (./test/noop/two.md)"));
	t.assert.ok(warnings[1].includes("`CSS` (./test/noop/three.md)"));
});

test("#2462 no warning for distinct tags", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addTemplate("one.md", "One", { tags: ["javascript"] });
			eleventyConfig.addTemplate("two.md", "Two", { tags: ["javascript ", "css"] });
		},
	});
	let warnings = captureWarnings(elev);

	await elev.toJSON();
	t.assert.strictEqual(warnings.length, 0);
});

test("#2462 tags that differ only by case throw by default", async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.addTemplate("one.md", "One", { tags: ["JavaScript"] });
			eleventyConfig.addTemplate("two.md", "Two", { tags: ["javascript"] });
		},
	});
	let warnings = captureWarnings(elev);

	await t.assert.rejects(elev.toJSON(), (error) => {
		let messages = [];
		for (let e = error; e; e = e.cause) {
			messages.push(e.message);
		}
		return messages.some((message) => message.includes("`JavaScript` (./test/noop/one.md), `javascript` (./test/noop/two.md)"));
	});
	t.assert.strictEqual(warnings.length, 0);
});

test(`#2462 tagCaseCollisions: "allow" skips the check`, async (t) => {
	let elev = new Eleventy("test/noop", false, {
		config(eleventyConfig) {
			eleventyConfig.configureErrorReporting({ tagCaseCollisions: "allow" });
			eleventyConfig.addTemplate("one.md", "One", { tags: ["JavaScript"] });
			eleventyConfig.addTemplate("two.md", "Two", { tags: ["javascript"] });
		},
	});
	let warnings = captureWarnings(elev);

	await elev.toJSON();
	t.assert.strictEqual(warnings.length, 0);
});
