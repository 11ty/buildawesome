const PREFIXES = {
	eleventy: "eleventy:",
	buildawesome: "buildawesome:",
};

// Should always cross-map to the attribute name that exists
// Request for eleventy: should map to buildawesome: if buildawesome: is in attrs (and vice versa)
export function resolveAttributeName(attrs = {}, attrName = "") {
	if (typeof attrName !== "string") {
		return;
	}
	let [prefix, name] = attrName.split(":");
	if (!prefix || !name) {
		return;
	}
	if (prefix && !(prefix in PREFIXES)) {
		return;
	}
	if (PREFIXES.buildawesome + name in attrs) {
		return PREFIXES.buildawesome + name;
	}
	if (PREFIXES.eleventy + name in attrs) {
		return PREFIXES.eleventy + name;
	}
}

export function hasAttribute(attrs = {}, attrName = "") {
	let resolved = resolveAttributeName(attrName);
	return attrs[resolved] !== undefined;
}
