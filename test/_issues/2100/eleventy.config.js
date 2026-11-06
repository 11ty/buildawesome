import { RenderPlugin } from "../../../src/Core.js";

export default function (cfg) {
	cfg.addPlugin(RenderPlugin);
}

export const config = {
	dir: {
		input: "content",
	},
};
