import { createDebug } from "./Util/DebugLogUtil.js";
import EventEmitter from "./Util/AsyncEventEmitter.js";

const debug = createDebug("EventBus");

/**
 * @module 11ty/eleventy/EventBus
 * @ignore
 */

debug("Setting up global EventBus.");
/**
 * Provides a global event bus that modules deep down in the stack can
 * subscribe to from a global singleton for decoupled pub/sub.
 * @type {module:11ty/eleventy/Util/AsyncEventEmitter~AsyncEventEmitter}
 */
let bus = new EventEmitter();
bus.setMaxListeners(100); // defaults to 10

debug("EventBus max listener count: %o", bus.getMaxListeners());

export default bus;
