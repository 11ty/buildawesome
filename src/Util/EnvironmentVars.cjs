// Used by CommonJS upstream (cmd.cjs and TypeScript feature test)

module.exports.getEnvValue = function(key) {
	if(!process?.env) {
		return;
	}

	return process.env[`BUILDAWESOME_${key}`] || process.env[`ELEVENTY_${key}`];
}

module.exports.setEnvValue = function(key, value) {
	if(!process?.env) {
		return;
	}

	process.env[`BUILDAWESOME_${key}`] = value;
	process.env[`ELEVENTY_${key}`] = value;
}
