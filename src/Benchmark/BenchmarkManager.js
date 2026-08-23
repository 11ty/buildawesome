import ConsoleLogger from "../Util/ConsoleLogger.js";
import BenchmarkGroup from "./BenchmarkGroup.js";

class BenchmarkManager {
	constructor() {
		this.benchmarkGroups = {};
		this.start = this.getNewTimestamp();
	}

	reset() {
		this.start = this.getNewTimestamp();

		for (var j in this.benchmarkGroups) {
			this.benchmarkGroups[j].reset();
		}
	}

	getNewTimestamp() {
		if (performance) {
			return performance.now();
		}
		return new Date().getTime();
	}

	/** @param {ConsoleLogger=} logger */
	setLogger(logger) {
		if (!logger) {
			return;
		}

		this.logger = logger;

		for (let group of Object.values(this.benchmarkGroups)) {
			group.setLogger(logger);
		}
	}

	/** @param {string} name */
	hasBenchmarkGroup(name) {
		return name in this.benchmarkGroups;
	}

	getBenchmarkGroup(name) {
		if (!this.benchmarkGroups[name]) {
			let group = new BenchmarkGroup();
			if (this.logger) {
				group.setLogger(this.logger);
			}

			// Special behavior for aggregate benchmarks
			// so they don’t console.log every time
			if (name === "Aggregate") {
				group.setIsVerbose(false);
			}

			this.benchmarkGroups[name] = group;
		}

		return this.benchmarkGroups[name];
	}

	getAll() {
		return this.benchmarkGroups;
	}

	get(name) {
		if (name) {
			return this.getBenchmarkGroup(name);
		}

		return this.getAll();
	}

	finish() {
		let totalTimeSpentBenchmarking = this.getNewTimestamp() - this.start;
		for (var j in this.benchmarkGroups) {
			this.benchmarkGroups[j].finish(j, totalTimeSpentBenchmarking);
		}
	}
}

export default BenchmarkManager;
