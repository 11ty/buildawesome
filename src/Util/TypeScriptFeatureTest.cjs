const { getEnvValue } = require("./EnvironmentVars.cjs");

/**
 * Checks whether the current Node.js runtime supports TypeScript type stripping.
 * @returns {boolean} `true` if the runtime supports TypeScript, `false` otherwise
 */
function canRequireTypeScript() {
	try {

		let res = require("./TypeScript/TypeScriptSample.cts");
		return typeof res === "function";
	} catch(e) {
		// Type stripping is not allowed in node_modules, but the error code tells us that it is supported by the runtime!
		let code = e && /** @type {{ code?: string }} */ (e).code;
		if(code === "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING") {
			return true;
		}
		return false;
	}
}

const TYPESCRIPT_ENABLED = canRequireTypeScript();

module.exports.isTypeScriptSupported = function() {
	if (getEnvValue("SKIP_TYPESCRIPT")) {
		return false;
	}

	return TYPESCRIPT_ENABLED;
}
