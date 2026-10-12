import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function getFirefoxInstance() {
	if (os.type() !== "Darwin") {
		return { browser: "firefox" };
	}

	// macOS 27 blocks Firefox’s shared app-data folder (“Could not find profile folder”), so give each run its own home
	let home = mkdtempSync(path.join(os.tmpdir(), "vitest-firefox-home-"));
	process.on("exit", () => rmSync(home, { recursive: true, force: true }));

	return {
		browser: "firefox",
		provider: playwright({
			launchOptions: {
				env: { ...process.env, CFFIXED_USER_HOME: home },
			},
		}),
	};
}

let instances = [{ browser: "chromium" }, getFirefoxInstance()];

if (os.type() === "Darwin") {
	instances.push({ browser: "webkit" });
}

export default defineConfig({
	test: {
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			screenshotFailures: false,
			// https://vitest.dev/guide/browser/playwright
			instances,
		},
	},
});
