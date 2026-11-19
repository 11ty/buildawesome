import matchSelector from "@11ty/posthtml-match-selector";
import { decodeHTML } from "entities";

import { resolveAttributeName } from "../Util/PostHtml/Attrs.js";

const POSTHTML_PLUGIN_NAME = "awesome.me/buildawesome/id-attribute";

function getTextNodeContent(node) {
	let ignoredAttrName = resolveAttributeName(node.attrs, "buildawesome:id-ignore");

	if (ignoredAttrName !== undefined) {
		delete node.attrs[ignoredAttrName];
		return "";
	}
	if (!node.content) {
		return "";
	}

	return node.content
		.map((entry) => {
			if (typeof entry === "string") {
				return entry;
			}
			if (Array.isArray(entry.content)) {
				return getTextNodeContent(entry);
			}
			return "";
		})
		.join("");
}

export function IdAttributePlugin(eleventyConfig, options = {}) {
	if (!options.slugify) {
		options.slugify = eleventyConfig.getFilter("slugify");
	}
	if (!options.selector) {
		options.selector = "[id],h1,h2,h3,h4,h5,h6";
	}
	options.decodeEntities = options.decodeEntities ?? true;
	options.checkDuplicates = options.checkDuplicates ?? "error";

	eleventyConfig.htmlTransformer.addPosthtmlPlugin(
		"html",
		function idAttributePosthtmlPlugin(pluginOptions = {}) {
			if (typeof options.filter === "function") {
				if (options.filter(pluginOptions) === false) {
					return function () {};
				}
			}

			return function (tree) {
				// One per page
				let usedIds = new Set();
				let headings = [];

				// Collect existing ids first so generated ids never collide with ids later in the document.
				tree.match(matchSelector(options.selector), function (node) {
					let id = node.attrs?.id;
					if (id) {
						if (usedIds.has(id) && options.checkDuplicates === "error") {
							throw new Error(
								'You have more than one HTML `id` attribute using the same value (id="' +
									id +
									'") in your template (' +
									pluginOptions.page.inputPath +
									"). You can disable this error in the IdAttribute plugin with the `checkDuplicates: false` option.",
							);
						}
						usedIds.add(id);
					} else if (node.content) {
						let textContent = getTextNodeContent(node);
						if (options.decodeEntities) {
							textContent = decodeHTML(textContent);
						}
						headings.push({ node, slug: options.slugify(textContent) });
					}

					return node;
				});

				// Reserve every heading's own slug so a suffixed duplicate (`foo-2`) can't take another heading's natural id.
				let reservedIds = new Set([...usedIds, ...headings.map(({ slug }) => slug)]);

				for (let { node, slug } of headings) {
					let id = slug;
					if (usedIds.has(id)) {
						let suffix = 2;
						while (reservedIds.has(`${slug}-${suffix}`)) {
							suffix++;
						}
						id = `${slug}-${suffix}`;
						reservedIds.add(id);
					}

					usedIds.add(id);
					node.attrs = node.attrs || {};
					node.attrs.id = id;
				}
			};
		},
		{
			// pluginOptions
			name: POSTHTML_PLUGIN_NAME,
		},
	);
}
