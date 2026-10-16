import test from "ava";
import { readFileSync, mkdtempSync } from "node:fs";
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
	t.true(passthrough.emulated);
	t.deepEqual(passthrough.map, {
		"/robots.txt": "./test/stubs/events-file-passthrough/robots.txt",
		"/img": "./test/stubs/events-file-passthrough/img/",
	});
});
