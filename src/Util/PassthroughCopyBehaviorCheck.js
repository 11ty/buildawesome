function isUsingEleventyDevServer(config) {
	return (
		!config.serverOptions.module || config.serverOptions.module === "@11ty/eleventy-dev-server"
	);
}

// Config opt-in via serverPassthroughCopyBehavior
// False when other server is used
// False when runMode is "build" or "watch"
export default function (config, runMode) {
	return (
		config.serverPassthroughCopyBehavior === "passthrough" &&
		isUsingEleventyDevServer(config) &&
		runMode === "serve"
	);
}
