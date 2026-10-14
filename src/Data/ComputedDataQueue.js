import { DepGraph as DependencyGraph } from "dependency-graph";

/* Dependency graph between computed data keys; keys are removed once computed. */
class ComputedDataQueue {
	constructor() {
		this.graph = new DependencyGraph();
	}

	getOrder() {
		return this.graph.overallOrder();
	}

	getOrderFor(name) {
		return this.graph.dependenciesOf(name);
	}

	getDependsOn(name) {
		return this.graph.dependantsOf(name);
	}

	isUsesStartsWith(name, prefix) {
		return (
			name.startsWith(prefix) ||
			this.graph.dependenciesOf(name).some((entry) => entry.startsWith(prefix))
		);
	}

	addNode(name) {
		if (!this.graph.hasNode(name)) {
			this.graph.addNode(name);
		}
	}

	uses(name, varsUsed = []) {
		this.addNode(name);

		for (let varUsed of varsUsed) {
			this.addNode(varUsed);
			this.graph.addDependency(name, varUsed);
		}
	}

	markComputed(varsComputed = []) {
		for (let varComputed of varsComputed) {
			this.graph.removeNode(varComputed);
		}
	}
}

export default ComputedDataQueue;
