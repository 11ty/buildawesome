import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import os from "node:os";

let instances = [{ browser: "chromium" }, { browser: "firefox" }];

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
