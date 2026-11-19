import test from "node:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../cmd.cjs", import.meta.url));

async function makeProject(t, extraFiles = {}) {
	const cwd = await mkdtemp(join(tmpdir(), "buildawesome-incremental-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));

	const files = {
		"content/posts/first.md": "# First post",
		"content/posts/second.njk": "<h1>Second post</h1>",
		"content/pages/third.md": "# Third page",
		"content/pages/other.md": "# Unrelated page",
		...extraFiles,
	};
	for (const [file, contents] of Object.entries(files)) {
		const path = join(cwd, file);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, contents);
	}

	return {
		run(...args) {
			return exec(
				process.execPath,
				[cli, "--input=content", "--output=public", "--formats=md,njk", ...args],
				{ cwd },
			);
		},
		output(...path) {
			return join(cwd, "public", ...path);
		},
	};
}

test("CLI incremental glob supports braces and comma-separated targets", async (t) => {
	const { run, output } = await makeProject(t);

	await run("--incremental=content/posts/*.{md,njk},content/pages/third.md");

	t.assert.match(await readFile(output("posts", "first", "index.html"), "utf8"), /First post/);
	t.assert.match(await readFile(output("posts", "second", "index.html"), "utf8"), /Second post/);
	t.assert.match(await readFile(output("pages", "third", "index.html"), "utf8"), /Third page/);
	await t.assert.rejects(stat(output("pages", "other")), { code: "ENOENT" });
});

test("Repeated incremental flags keep literal filenames with glob characters or commas", async (t) => {
	const { run, output } = await makeProject(t, {
		"content/pages/part[1],copy.md": "# Literal filename",
	});

	await run("--incremental=content/posts/*.md", "--incremental=content/pages/part[1],copy.md");

	t.assert.match(await readFile(output("posts", "first", "index.html"), "utf8"), /First post/);
	t.assert.match(await readFile(output("pages", "part[1],copy", "index.html"), "utf8"), /Literal filename/);
	await t.assert.rejects(stat(output("posts", "second")), { code: "ENOENT" });
	await t.assert.rejects(stat(output("pages", "other")), { code: "ENOENT" });
});

test("An unmatched incremental glob fails before writing any output", async (t) => {
	const { run, output } = await makeProject(t);

	await t.assert.rejects(
		run("--incremental=content/posts/*.md", "--incremental=content/missing/*.md"),
		(error) => error.code === 1 && /matched no files.*content\/missing\/\*\.md/.test(error.stderr),
	);
	await t.assert.rejects(stat(output()), { code: "ENOENT" });
});

test("A missing literal incremental target keeps existing behavior", async (t) => {
	const { run, output } = await makeProject(t);

	await run("--incremental=content/posts/first.md,content/posts/deleted.md");

	t.assert.match(await readFile(output("posts", "first", "index.html"), "utf8"), /First post/);
	t.assert.match(await readFile(output("pages", "other", "index.html"), "utf8"), /Unrelated page/);
});

test("A literal unmatched bracket does not swallow the next comma-separated target", async (t) => {
	const { run, output } = await makeProject(t, {
		"content/pages/edge[.md": "# Literal bracket",
	});

	await run("--incremental=content/pages/edge[.md,content/posts/first.md");

	t.assert.match(await readFile(output("pages", "edge[", "index.html"), "utf8"), /Literal bracket/);
	t.assert.match(await readFile(output("posts", "first", "index.html"), "utf8"), /First post/);
	await t.assert.rejects(stat(output("pages", "other")), { code: "ENOENT" });
});

test("Incremental globs keep the normal full-build fallback for untracked includes", async (t) => {
	const { run, output } = await makeProject(t, {
		"content/_includes/shared.njk": "<span>Shared include</span>",
		"content/posts/second.njk": "{% include 'shared.njk' %}",
	});

	await run("--incremental=content/_includes/*.njk");

	t.assert.match(await readFile(output("posts", "second", "index.html"), "utf8"), /Shared include/);
	t.assert.match(await readFile(output("pages", "other", "index.html"), "utf8"), /Unrelated page/);
});

test("Broad incremental globs respect project and default ignores", async (t) => {
	const { run, output } = await makeProject(t, {
		".eleventyignore": "content/pages/other.md\n",
		"public/old-output.md": "# Old output",
		"node_modules/synthetic-package/readme.md": "# Package documentation",
	});

	await run("--incremental=**/*.md");

	t.assert.match(await readFile(output("posts", "first", "index.html"), "utf8"), /First post/);
	t.assert.match(await readFile(output("pages", "third", "index.html"), "utf8"), /Third page/);
	await t.assert.rejects(stat(output("pages", "other")), { code: "ENOENT" });
	await t.assert.rejects(stat(output("posts", "second")), { code: "ENOENT" });
});
