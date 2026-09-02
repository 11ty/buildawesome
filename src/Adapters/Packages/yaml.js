// `parseEvents` reports zero-based, end-exclusive source spans per node, which is what
// makes surgical (comment- and formatting-preserving) YAML edits possible.
export {
	parseEvents,
	load,
	getScalarValue,
	dump,
	EVENT_ID,
	SCALAR_STYLE,
	COLLECTION_STYLE,
	CHOMPING_MODE,
} from "js-yaml";
