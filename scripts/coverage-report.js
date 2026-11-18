import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const coverage = JSON.parse(
	readFileSync(path.join(root, "coverage/coverage-summary.json"), "utf8"),
);

let rows = Object.entries(coverage).map(([file, { lines, statements, functions, branches }]) => {
	let name = path.isAbsolute(file) ? path.relative(root, file) : file;
	return `| \`${name}\` | ${lines.pct}% | ${statements.pct}% | ${functions.pct}% | ${branches.pct}% |`;
});

writeFileSync(
	path.join(root, "docs/coverage.md"),
	`# Code Coverage for Build Awesome v${pkg.version}

| Filename | % Lines | % Statements | % Functions | % Branches |
| --- | --- | --- | --- | --- |
${rows.join("\n")}
`,
);
