import test from "node:test";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Core from "../src/Core.js";
import { NdjsonReporter } from "../src/Reporters/NdjsonReporter.js";

function readEvents(filePath) {
	return readFileSync(filePath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("passthrough event is emulated in serve mode with serverPassthroughCopyBehavior", async (t) => {
	// Dry run skips passthrough results
	let dir = mkdtempSync(path.join(tmpdir(), "ndjson-"));
	let eventsFile = path.join(dir, ".events.ndjson");
	let core = new Core("test/stubs/events-file-passthrough", path.join(dir, "_site"), {
		runMode: "serve",
		quietMode: true,
		configPath: "test/stubs/events-file-passthrough.config.js",
		config(eleventyConfig) {
			eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
		},
	});
	core.setReporter(new NdjsonReporter(eventsFile));
	core.disableLogger();
	await core.write();

	let events = readEvents(eventsFile);
	let passthrough = events.find((e) => e.type === "passthrough");
	t.assert.strictEqual(passthrough.emulated, true);
	t.assert.deepStrictEqual(passthrough.map, {
		"/robots.txt": "./test/stubs/events-file-passthrough/robots.txt",
		"/img": "./test/stubs/events-file-passthrough/img/",
	});
	t.assert.deepStrictEqual(passthrough.copied, []);
});

test("passthrough event lists passthroughs the dev server can’t emulate as copied", async (t) => {
	let dir = mkdtempSync(path.join(tmpdir(), "ndjson-"));
	let eventsFile = path.join(dir, ".events.ndjson");
	let core = new Core("test/stubs/events-file-passthrough", path.join(dir, "_site"), {
		runMode: "serve",
		quietMode: true,
		configPath: false,
		config(eleventyConfig) {
			eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
			eleventyConfig.addPassthroughCopy("test/stubs/events-file-passthrough/robots.txt");
			eleventyConfig.addPassthroughCopy({ "test/stubs/events-file-passthrough/img": "img" }, { rename: (p) => p });
		},
	});
	core.setReporter(new NdjsonReporter(eventsFile));
	core.disableLogger();
	await core.write();

	let passthrough = readEvents(eventsFile).find((e) => e.type === "passthrough");
	t.assert.strictEqual(passthrough.emulated, true);
	t.assert.deepStrictEqual(passthrough.copied, ["/img/a.txt"]);
	t.assert.strictEqual(Object.keys(passthrough.map).includes("/robots.txt"), true);
});

test("passthrough event skips files excluded by `dot` and `junk`", async (t) => {
	// Inside the project, absolute input paths on another drive fail on Windows
	let dir = "test/_generated/ndjson-dot-junk";
	rmSync(dir, { recursive: true, force: true });
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	// Globs need forward slashes
	let input = path.posix.join(dir, "src");
	mkdirSync(path.join(input, "og/sources"), { recursive: true });
	writeFileSync(path.join(input, "index.md"), "");
	writeFileSync(path.join(input, "og/sources/a.txt"), "");
	writeFileSync(path.join(input, "og/sources/.DS_Store"), "");
	writeFileSync(path.join(input, "og/sources/Thumbs.db"), "");

	for (let [runMode, behavior] of [["build", "copy"], ["serve", "passthrough"], ["watch", "copy"]]) {
		for (let entry of ["og/sources/", "og/sources/*", "og/sources/**"]) {
			let eventsFile = path.join(dir, `${runMode}-${entry.replaceAll(/\W/g, "")}.ndjson`);
			let core = new Core(input, path.join(dir, "_site"), {
				runMode,
				quietMode: true,
				configPath: false,
				config(eleventyConfig) {
					eleventyConfig.setServerPassthroughCopyBehavior(behavior);
					eleventyConfig.setPassthroughCopyOptions({ dot: false });
					eleventyConfig.addPassthroughCopy({ [path.posix.join(input, entry)]: "og/sources" });
				},
			});
			core.setReporter(new NdjsonReporter(eventsFile));
			core.disableLogger();
			await core.init();
			await core.write();

			// Incremental rebuild from a change to a filtered file
			core.setIncrementalFile(path.join(input, "og/sources/.DS_Store"));
			await core.write();

			let events = readEvents(eventsFile).filter((e) => e.type === "passthrough");
			t.assert.strictEqual(events.length, 2);
			for (let { map, copied } of events) {
				let urls = Object.keys(map).concat(copied);
				t.assert.strictEqual(urls.length > 0, true, `${runMode} ${entry}`);
				t.assert.strictEqual(urls.some((url) => /DS_Store|Thumbs\.db/.test(url)), false, `${runMode} ${entry}: ${urls}`);
			}
		}
	}
});

test("watch run with a throwing config writes one `build.error`, then recovers", async (t) => {
	// Inside the project so the config file can import Core’s dependencies
	let dir = "test/_generated/ndjson-config-error";
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	t.after(() => rmSync(dir, { recursive: true, force: true }));

	let configPath = path.join(dir, "eleventy.config.js");
	writeFileSync(configPath, "export default function() {};");
	writeFileSync(path.join(dir, "index.md"), "Hello");

	let eventsFile = path.join(mkdtempSync(path.join(tmpdir(), "ndjson-")), ".events.ndjson");
	let core = new Core(dir, path.join(dir, "_site"), { runMode: "watch", configPath });
	core.setReporter(new NdjsonReporter(eventsFile));
	core.disableLogger();
	await core.init();
	await core.write();

	// Skip chokidar
	core.watcher = { watchTargets() {}, close() {} };
	core.startWatch = async () => {};

	writeFileSync(configPath, `export default function() { throw new Error("sdlkfj"); };`);
	await core.triggerWatchRunForPath(`./${configPath}`);

	let readBuildEvents = () => readEvents(eventsFile).filter((e) => e.type.startsWith("build."));
	let events = readBuildEvents();
	t.assert.deepStrictEqual(events.map((e) => e.type), ["build.start", "build.end", "build.error"]);
	let { error, ok, durationMs } = events[2];
	t.assert.strictEqual(ok, false);
	t.assert.strictEqual(durationMs, null);
	t.assert.strictEqual(error.name, "ConfigError");
	t.assert.strictEqual(error.message.includes("eleventy.config.js"), true);

	writeFileSync(configPath, "export default function() {};");
	await core.triggerWatchRunForPath(`./${configPath}`);

	events = readBuildEvents();
	t.assert.deepStrictEqual(events.slice(3).map((e) => e.type), ["build.start", "build.end"]);
	t.assert.strictEqual(events[4].ok, true);
});

test("an error already reported by the build isn’t reported again", async (t) => {
	let dir = mkdtempSync(path.join(tmpdir(), "ndjson-"));
	let eventsFile = path.join(dir, ".events.ndjson");
	let core = new Core("test/stubs-virtual/", path.join(dir, "_site"), {
		quietMode: true,
		configPath: false,
		config(eleventyConfig) {
			eleventyConfig.addTemplate("index.11ty.js", {
				render() {
					throw new Error("Template failed");
				},
			});
		},
	});
	core.setReporter(new NdjsonReporter(eventsFile));
	core.disableLogger();
	core.setIsVerbose(false);

	let error;
	await t.assert.rejects(() => core.write(), (err) => {
		error = err;
		return true;
	});
	core.reportError(error);

	let errors = readEvents(eventsFile).filter((e) => e.type === "build.error");
	t.assert.strictEqual(errors.length, 1);
	t.assert.strictEqual(typeof errors[0].durationMs, "number");
});
