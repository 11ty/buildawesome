import { createDebug } from "../Util/DebugLogUtil.js";
import isAsyncFunction from "../Util/IsAsyncFunction.js";
import Benchmark from "./Benchmark.js";

const debugBenchmark = createDebug("Benchmark");

class BenchmarkGroup {
	constructor() {
		this.benchmarks = {};

		this.isVerbose = true;
		this.minimumThresholdMs = 50;
		this.minimumThresholdPercent = 8;
	}

	setLogger(logger) {
		this.logger = logger;
	}

	// This is an override for aggregate benchmarks automatically default to false via BenchmarkManager->getBenchmarkGroup
	setIsVerbose(isVerbose) {
		this.isVerbose = isVerbose;
	}

	reset() {
		for (var type in this.benchmarks) {
			this.benchmarks[type].reset();
		}
	}

	// TODO use addAsync everywhere instead
	add(type, callback) {
		let benchmark = (this.benchmarks[type] = new Benchmark());

		/** @this {any} */
		let fn = function (...args) {
			benchmark.before();
			let ret = callback.call(this, ...args);
			benchmark.after();
			return ret;
		};

		Object.defineProperty(fn, "__eleventyInternal", {
			value: {
				type: isAsyncFunction(callback) ? "async" : "sync",
				callback,
			},
		});

		return fn;
	}

	// callback must return a promise
	// async addAsync(type, callback) {
	//   let benchmark = (this.benchmarks[type] = new Benchmark());

	//   benchmark.before();
	//   // don’t await here.
	//   let promise = callback.call(this);
	//   promise.then(function() {
	//     benchmark.after();
	//   });
	//   return promise;
	// }

	setMinimumThresholdMs(minimumThresholdMs) {
		let val = parseInt(minimumThresholdMs, 10);
		if (isNaN(val)) {
			throw new Error("`setMinimumThresholdMs` expects a number argument.");
		}
		this.minimumThresholdMs = val;
	}

	setMinimumThresholdPercent(minimumThresholdPercent) {
		let val = parseInt(minimumThresholdPercent, 10);
		if (isNaN(val)) {
			throw new Error("`setMinimumThresholdPercent` expects a number argument.");
		}
		this.minimumThresholdPercent = val;
	}

	has(type) {
		return !!this.benchmarks[type];
	}

	get(type) {
		if (!this.benchmarks[type]) {
			this.benchmarks[type] = new Benchmark();
		}
		return this.benchmarks[type];
	}

	padNumber(num, length) {
		if (("" + num).length >= length) {
			return num;
		}

		let prefix = new Array(length + 1).join(" ");
		return (prefix + num).slice(-1 * length);
	}

	finish(label, totalTimeSpent) {
		for (var type in this.benchmarks) {
			let bench = this.benchmarks[type];
			let isAbsoluteMinimumComparison = this.minimumThresholdMs > 0;
			let totalForBenchmark = bench.getTotal();
			let percent = Math.round((totalForBenchmark * 100) / totalTimeSpent);
			let callCount = bench.getTimesCalled();

			let output = {
				ms: this.padNumber(totalForBenchmark.toFixed(0), 6),
				percent: this.padNumber(percent, 3),
				calls: this.padNumber(callCount, 5),
			};
			let str = `Benchmark ${output.ms}ms ${output.percent}% ${output.calls}× (${label}) ${type}`;

			if (
				isAbsoluteMinimumComparison &&
				totalForBenchmark >= this.minimumThresholdMs &&
				percent > this.minimumThresholdPercent
			) {
				if (this.isVerbose) {
					this.logger.warn(str);
				}
			}

			// Opt out of logging if low count (1× or 2×) or 0ms / 1%
			if (
				callCount > 1 || // called more than once
				Math.round(totalForBenchmark) > 0 // more than 0.5ms
			) {
				debugBenchmark(str);
			}
		}
	}
}

export default BenchmarkGroup;
