import eventBus from "../EventBus.js";
import { createDebug } from "./DebugLogUtil.js";

const debug = createDebug("EventBus");

class EventBusUtil {
	static debugCurrentListenerCounts() {
		for (let name of eventBus.eventNames()) {
			debug("Listeners for %o: %o", name, eventBus.listenerCount(name));
		}
	}
}

export default EventBusUtil;
