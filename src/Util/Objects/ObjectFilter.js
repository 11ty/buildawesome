export default function objectFilter(obj, callback) {
	let newObject = {};
	for (let [key, value] of Object.entries(obj || {})) {
		if (callback(value, key)) {
			newObject[key] = value;
		}
	}
	return newObject;
}
