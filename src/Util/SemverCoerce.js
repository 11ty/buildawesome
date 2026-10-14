// This replaces use of semver/functions/coerce.js (which had more than we needed, we’re only targeting our local package.json for eleventy supplied global data)

export function coerce(version) {
	let s = String(version);
	if (s.startsWith("v")) {
		s = s.slice(1);
	}
	// Remove pre-release identifier
	return s.split("-")[0];
}
