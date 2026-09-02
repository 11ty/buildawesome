import test from "ava";

import ReservedData from "../src/Util/ReservedData.js";
import { DEFAULT_RESERVED_KEYS } from "../packages/datawriter/src/DataWriter.js";

// `@awesome.me/ba-datawriter` is standalone: it carries its own copy of the reserved
// property names rather than importing them, so it can be used without Eleventy. This
// asserts the copy has not drifted from the list Eleventy actually enforces.
test("The datawriter package’s reserved key list matches ReservedData", (t) => {
	let expected = [
		...ReservedData.fullProperties,
		...ReservedData.pageProperties.map((key) => `page.${key}`),
	];

	t.deepEqual([...DEFAULT_RESERVED_KEYS].sort(), expected.sort());
});
