// Types for configuration APIs added at runtime by defaultConfigExtended.js and the bundle plugin.

export interface BundleOptions {
	hoist?: boolean;
	delayed?: boolean;
	outputFileExtension?: string;
	shortcodeName?: string | false;
	toFileDirectory?: string;
	transforms?: Function[];
	bundleExportKey?: string | false;
	bundleHtmlContentFromSelector?: string;
}

export interface HtmlTransformerCallbackOptions {
	name?: string;
	priority?: number;
	enabled?: (context: any) => boolean;
	pluginOptions?: any;
}

export interface HtmlTransformer {
	addUrlTransform(
		extensions: string,
		callback: (this: any, url: string) => unknown,
		options?: HtmlTransformerCallbackOptions,
	): void;
	addPosthtmlPlugin(
		extensions: string,
		plugin: Function,
		options?: HtmlTransformerCallbackOptions,
	): void;
	setPosthtmlProcessOptions(options: Record<string, any>): void;
	remove(extensions: string, match: Function): void;
}

declare module "./UserConfig.js" {
	export default interface UserConfig {
		addBundle(name: string, options?: BundleOptions): void;
		getBundleManagers(): Record<string, any>;
		htmlTransformer: HtmlTransformer;
	}
}

export {};
