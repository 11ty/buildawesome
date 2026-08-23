#!/usr/bin/env node

// This file intentionally uses older code conventions to be as friendly
// as possible with error messaging to folks on older runtimes.

const pkg = require("./package.json");
require("@11ty/node-version-check")(pkg, {
	message: function (requiredVersion) {
		return (
			"Build Awesome (Eleventy) " +
			pkg.version +
			" requires Node " +
			requiredVersion +
			". You will need to upgrade Node!"
		);
	},
});

const minimist = require("minimist");

class SimpleError extends Error {
	constructor(...args) {
		super(...args);
		this.skipOriginalStack = true;
	}
}

async function exec() {
	const { createDebug } = await import("./src/Util/DebugLogUtil.js");
	const debug = createDebug("CLI");

	// Notes about friendly error messaging with outdated Node versions: https://github.com/11ty/buildawesome/issues/3761
	const { ErrorHandler } = await import("./src/Errors/ErrorHandler.js");
	const { getEnvValue } = await import("./src/Util/EnvironmentVars.cjs");
	const { default: ConsoleLogger } = await import("./src/Util/ConsoleLogger.js");

	// Defensive use of Node 22.8+ Module Compile Cache
	if(!getEnvValue("SKIP_NODE_COMPILE_CACHE")) {
		try {
			const nodeMod = await import('node:module').then(mod => mod.default);
			nodeMod.enableCompileCache?.();
		} catch(e) {
			debug("Node compile cache error (ignored: optional API) %o", e);
		}
	}

	try {
		function getFallbackErrorHandler() {
			let handler = new ErrorHandler();
			handler.logger = new ConsoleLogger();
			return handler;
		}

		const argv = minimist(process.argv.slice(2), {
			string: ["input", "output", "formats", "config", "pathprefix", "port", "to", "incremental", "loader"],
			boolean: [
				"quiet",
				"version",
				"watch",
				"dryrun",
				"help",
				"serve",
				"ignore-initial",
			],
			default: {
				quiet: null,
				"ignore-initial": false,
				"to": "fs",
			},
			unknown: function (unknownArgument) {
				throw new Error(
					`We don’t know what '${unknownArgument}' is. Use --help to see the list of supported commands.`,
				);
			},
		});

		debug("Arguments: %o", argv);
		const { default: Core } = await import("./src/Core.js");

		let handler = getFallbackErrorHandler();

		process.on("unhandledRejection", (error, promise) => {
			handler.fatal(error, "Unhandled rejection in promise");
		});
		process.on("uncaughtException", (error) => {
			handler.fatal(error, "Uncaught exception");
		});
		process.on("rejectionHandled", (promise) => {
			handler.warn(promise, "A promise rejection was handled asynchronously");
		});

		if (argv.version) {
			console.log(Core.getVersion());
			return;
		} else if (argv.help) {
			console.log(Core.getHelp());
			return;
		}

		let core = new Core(argv.input, argv.output, {
			source: "cli",
			// --quiet and --quiet=true both resolve to true
			quietMode: argv.quiet,
			configPath: argv.config,
			pathPrefix: argv.pathprefix,
			runMode: argv.serve ? "serve" : argv.watch ? "watch" : "build",
			dryRun: argv.dryrun,
			loader: argv.loader,
		});

		// override with ErrorHandler instance in Core
		handler = core.errorHandler;

		// Before init
		core.setFormats(argv.formats);

		await core.init();

		if (argv.to === "json") {
			// override logging output
			core.setIsVerbose(false);
		}

		// Only relevant for watch/serve
		core.setIgnoreInitial(argv["ignore-initial"]);

		// v4.0.0-alpha.8 multiple now supported via:
		// --incremental=one.md --incremental=two.md => ["one.md", "two.md"]
		// --incremental=one.md,two.md => ["one.md", "two.md"]
		if(argv.incremental) {
			core.setIncrementalFiles(argv.incremental);
		} else if(argv.incremental !== undefined) {
			core.setIncrementalBuild(argv.incremental === "" || argv.incremental);
		}

		if (argv.serve || argv.watch) {
			if(argv.to === "json") {
				throw new SimpleError("--to=json is not compatible with --serve or --watch.");
			}

			await core.watch();

			if (argv.serve) {
				// TODO await here?
				core.serve(argv.port);
			}

			process.on("SIGINT", async () => {
				core.interrupt();

				await core.stopWatch();
				process.exitCode = 0;
			});
		} else {
			// `fs:templates` will skip passthrough copy
			if (!argv.to || argv.to === "fs" || argv.to.startsWith("fs:")) {
				await core.write(argv.to);
			} else if (argv.to === "json") {
				let result = await core.toJSON()
				console.log(JSON.stringify(result, null, 2));
			} else {
				throw new SimpleError(
					`Invalid --to value: ${argv.to}. Supported values: \`fs\` (default), \`json\`.`,
				);
			}
		}
	} catch (error) {
		if(typeof ErrorHandler !== "undefined") {
			let handler = getFallbackErrorHandler();
			handler.fatal(error, "Fatal Error (CLI)");
		} else {
			console.error(error);
			process.exitCode = 1;
		}
	}
}

// await
exec();
