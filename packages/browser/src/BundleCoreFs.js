import "./shims/shim-core.js";

// @11ty/eleventy-plugin-bundle is not exported here (differing from Node package) but *is* bundled (and exposed via Configuration API)
export { IdAttributePlugin } from "../../../src/Plugins/IdAttributePlugin.js";
export { default as HtmlBasePlugin } from "../../../src/Plugins/HtmlBasePlugin.js";
export { TransformPlugin as InputPathToUrlTransformPlugin } from "../../../src/Plugins/InputPathToUrl.js";
export { default as RenderPlugin } from "../../../src/Plugins/RenderPlugin.js";
// i18n Plugin is separate (see BundleI18nPlugin.js and @11ty/client/i18n)

// Note for future visitors, an attempt was made to separate these plugins the bundle (so that they could be exported separately)
// - HtmlBasePlugin and InputPathToUrl were moved to async in the ResolvePlugin.js adapter.
// - Extended configuration was removed from defaultConfig.js
// This saved ~400KB (unmin) from the bundle but the separate bundle was way larger than the savings (> 1MB)

export { CoreFs as Eleventy, CoreFs as BuildAwesome } from "../../../src/CoreFs.js";

export { default as FileSystem } from "node:fs";
