// Checking src/Core.js directly produces too many type errors.
import type UserConfig from "./UserConfig.js";

export type { default as UserConfig } from "./UserConfig.js";

export type ConfigurationApi = ($config: UserConfig) => unknown;

export function defineConfig<T extends ConfigurationApi>(callback: T): T;

type Plugin = ($config: UserConfig, options?: any) => any;

export interface CoreOptions {
	/** The input directory (or a single input file). Mirrors the --input CLI flag. */
	input?: string;
	/** The output directory. Mirrors the --output CLI flag. */
	output?: string;
	source?: "cli" | "script";
	runMode?: "build" | "serve" | "watch";
	/** When true, runs a full build but does not write anything to the file system. */
	dryRun?: boolean;
	/** Path to a configuration file. Equivalent to the --config CLI flag. */
	configPath?: string;
	/** Prepends this value to all URLs. Equivalent to the --pathprefix CLI option used with the HTML <base> plugin. */
	pathPrefix?: string;
	/** When true, suppresses the build output logging. Equivalent to the --quiet CLI flag. */
	quietMode?: boolean;
	/** The input directory (or a single input file). Mirrors the --input CLI flag. */
	inputDir?: string;
	/** Force the module mode: "esm", "cjs", or "auto" (detected from your package.json type). */
	loader?: "esm" | "cjs" | "auto";
	/** A configuration callback that receives the config API object. */
	config?: (api: ? extends ConfigurationApi) => void;
}

declare class Core {
	constructor(options?: CoreOptions, templateConfig?: any);
	/** Prefer `new Eleventy({ input, output, ...options })`. */
	constructor(
		input?: string,
		output?: string,
		options?: Omit<CoreOptions, "input" | "output">,
		templateConfig?: any,
	);
	[key: string]: any;
}

export default Core;
export { Core as Eleventy };

export function ImportFile(
	localPath: string,
	type?: string,
	options?: Record<string, any>,
): Promise<any>;

export const BundlePlugin: Plugin;
export const RenderPlugin: Plugin;
/** @deprecated Renamed to {@link RenderPlugin}. */
export const EleventyRenderPlugin: typeof RenderPlugin;
export const I18nPlugin: Plugin;
/** @deprecated Renamed to {@link I18nPlugin}. */
export const EleventyI18nPlugin: typeof I18nPlugin;
export const HtmlBasePlugin: Plugin;
/** @deprecated Renamed to {@link HtmlBasePlugin}. */
export const EleventyHtmlBasePlugin: typeof HtmlBasePlugin;
export const InputPathToUrlTransformPlugin: Plugin;
export const IdAttributePlugin: Plugin;
export const PreserveClosingTagsPlugin: Plugin;

/** @deprecated Removed in v3. */
export function EleventyServerlessBundlerPlugin(): never;
/** @deprecated Removed in v3. */
export function EleventyServerless(): never;
/** @deprecated Removed in v3. */
export function EleventyEdgePlugin(): never;
