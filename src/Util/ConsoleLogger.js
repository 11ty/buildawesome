import { createDebug } from "./DebugLogUtil.js";
import chalk from "../Adapters/Packages/chalk.js";

import { isUsingBuildAwesome } from "../Util/IsBuildAwesome.js";

const debug = createDebug("Logger");

/**
 * Logger implementation that logs to STDOUT.
 * @typedef {'error'|'log'|'warn'|'info'} LogType
 */
class ConsoleLogger {
	/** @type {boolean} */
	#isVerbose = true;
	/** @type {boolean} */
	#isChalkEnabled = true;
	/** @type {object|boolean|undefined} */
	#logger;
	/** @type {string} */
	#defaultLogPrefix = "[11ty]";
	/** @type {object} */
	#colorFallbacks = {
		info: "blue",
		warn: "yellow",
		error: "red",
	};

	constructor() {
		// via ENV variables
		if (isUsingBuildAwesome()) {
			this.setPrefix(`[buildawesome]`);
		}
	}

	isLoggingEnabled() {
		if (!this.isVerbose || process.env.DEBUG) {
			return true;
		}
		return this.#logger !== false;
	}

	setPrefix(prefix) {
		this.#defaultLogPrefix = prefix;
	}

	get isVerbose() {
		return this.#isVerbose;
	}

	set isVerbose(verbose) {
		this.#isVerbose = !!verbose;
	}

	get isChalkEnabled() {
		return this.#isChalkEnabled;
	}

	set isChalkEnabled(enabled) {
		this.#isChalkEnabled = !!enabled;
	}

	overrideLogger(logger) {
		this.#logger = logger;
	}

	get logger() {
		if (this.#logger) {
			return this.#logger;
		}
		if ("console" in globalThis) {
			return globalThis.console;
		}
		throw new Error(
			"Internal JavaScript runtime error: No logger instance found (is globalThis not supported?).",
		);
	}

	/** @param {string} msg */
	log(msg) {
		this.message(msg);
	}

	/**
	 * @typedef LogOptions
	 * @property {string} message
	 * @property {string=} prefix
	 * @property {LogType=} type
	 * @property {string=} color
	 * @property {boolean=} force
	 * @param {LogOptions} options
	 */
	logWithOptions({ message, type, prefix, color, force }) {
		this.message(message, type, color, force, prefix);
	}

	/** @param {string} msg */
	forceLog(msg) {
		this.message(msg, undefined, undefined, true);
	}

	/** @param {string} msg */
	info(msg) {
		this.message(msg, "log", this.#colorFallbacks.info);
	}

	/** @param {string} msg */
	warn(msg) {
		this.message(msg, "warn", this.#colorFallbacks.warn);
	}

	/** @param {string} msg */
	error(msg) {
		this.message(msg, "error", this.#colorFallbacks.error);
	}

	/** @param {string} message */
	#dim(message) {
		if ("dim" in chalk) {
			return chalk.dim(message);
		}
		return message;
	}

	/**
	 * Formats the message to log.
	 *
	 * @param {string} message - The raw message to log.
	 * @param {LogType} [type='log'] - The error level to log.
	 * @param {string|undefined} [chalkColor=undefined] - Color name or falsy to disable
	 * @param {boolean} [forceToConsole=false] - Enforce a log on console instead of specified target.
	 * @param {string|undefined} [prefix=undefined] - Dimmed string at the start of each line
	 */
	message(
		message,
		type = "log",
		chalkColor = undefined,
		forceToConsole = false,
		prefix = undefined,
	) {
		if (!forceToConsole && (!this.isVerbose || process.env.DEBUG)) {
			debug(message);
		} else if (this.#logger !== false) {
			if (prefix === undefined) {
				prefix = this.#defaultLogPrefix;
			}

			let prefixStr = prefix ? `${this.#dim(prefix)} ` : "";
			message = `${prefixStr}${message.split("\n").join(`\n${prefixStr}`)}`;

			// default color for every type but log
			if (chalkColor === undefined && type) {
				chalkColor = this.#colorFallbacks[type];
			}

			if (chalkColor && this.isChalkEnabled) {
				this.logger[type](chalk[chalkColor](message));
			} else {
				this.logger[type](message);
			}
		}
	}
}

export default ConsoleLogger;
