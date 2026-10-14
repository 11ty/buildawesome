import test from "ava";
import lodash from "@11ty/lodash-custom";
import { ProxyWrap } from "../src/Util/Objects/ProxyWrap.js";
import { DeepFreeze } from "../src/Util/Objects/DeepFreeze.js";

const { set: lodashSet } = lodash;

test("Lodash sanity tests", t => {
	t.deepEqual(lodashSet({}, "test", true), {"test": true});
	t.deepEqual(lodashSet({}, "metadata.title", true), {"metadata": {title: true}});
});

test("Lodash set on proxy", t => {
	let target = {};
	let obj = ProxyWrap(target, {});
	let ret = lodashSet(obj, "metadata.title", "test");
	t.deepEqual(ret, {metadata: {title: "test"}});
});

test("Lodash set on proxy object with data", t => {
	// let target = { metadata: { title: "default" } };
	let target = {};
	let fallback = {};
	let obj = ProxyWrap(target, fallback);
	lodashSet(obj, "metadata.title", "test");
	t.deepEqual(obj, {metadata: {title: "test"}});
});

// TODO re-add support for frozen fallbacks
test.skip("Fallback is *not* mutated (is frozen) (does not exist in fallback)", t => {
	let fallback = {};

	// oh my god freeze is shallow
	DeepFreeze(fallback);

	let target1 = ProxyWrap({ first: true, metadata: { a: 1 } }, fallback);
	let target2 = ProxyWrap({ second: true, metadata: { b: 1 } }, fallback);

	lodashSet(fallback, "metadata.c", 999); // does nothing

	lodashSet(target1, "metadata.c", 1);

	t.is(target1.metadata.c, 1);
	t.is(target2.metadata.c, undefined);

	t.deepEqual(target1, { first: true, metadata: { a: 1, c: 1}});
	t.deepEqual(target2, { second: true, metadata: { b: 1 } });
});

// TODO re-add support for frozen fallbacks
test.skip("Fallback is *not* mutated (is frozen) (exists in fallback)", t => {
	let fallback = {
		metadata: { d: 888 }
	};

	// Object.freeze is shallow
	DeepFreeze(fallback);

	let target3 = ProxyWrap({ third: true }, fallback);

	t.deepEqual(target3, { third: true, metadata: { d: 888 }});

	lodashSet(target3, "metadata.d", "all");

	t.deepEqual(target3, { third: true, metadata: { d: "all" }});
});
