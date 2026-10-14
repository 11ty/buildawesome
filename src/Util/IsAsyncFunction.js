const ComparisonAsyncFunction = (async () => {}).constructor;

export default function isAsyncFunction(fn) {
	return fn instanceof ComparisonAsyncFunction;
}
