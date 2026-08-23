import { spawn } from "node:child_process";

export function spawnAsync(command, args, options) {
	let { promise, resolve, reject } = Promise.withResolvers();

	const cmd = spawn(command, args, options);
	let res = [];
	cmd.stdout.on("data", (data) => {
		res.push(data.toString("utf8"));
	});

	let err = [];
	cmd.stderr.on("data", (data) => {
		err.push(data.toString("utf8"));
	});

	cmd.on("close", (code) => {
		if (err.length > 0) {
			reject(err.join("\n"));
		} else if (code === 1) {
			reject("Internal error: process closed with error exit code.");
		} else {
			resolve(res.join("\n"));
		}
	});

	return promise;
}
