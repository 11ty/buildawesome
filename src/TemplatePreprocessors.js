export class TemplatePreprocessors {
	static async runAll(preprocessors, template, data) {
		let { inputPath } = template;

		let content = await template.getPreRender();

		let skippedVia = false;
		for (let [name, preprocessor] of Object.entries(preprocessors || {})) {
			let { filter, callback } = preprocessor;

			let filters;
			if (Array.isArray(filter)) {
				filters = filter;
			} else if (typeof filter === "string") {
				filters = filter.split(",");
			} else {
				throw new Error(
					`Expected file extensions passed to "${name}" content preprocessor to be a string or array. Received: ${filter}`,
				);
			}

			filters = filters.map((extension) => {
				if (extension.startsWith(".") || extension === "*") {
					return extension;
				}

				return `.${extension}`;
			});

			if (!filters.some((extension) => extension === "*" || inputPath.endsWith(extension))) {
				// skip
				continue;
			}

			try {
				let ret = await callback.call(
					{
						inputPath,
					},
					data,
					content,
				);

				// Returning explicit false is the same as ignoring the template
				if (ret === false) {
					skippedVia = name;
					continue;
				}

				// Different from transforms: returning falsy (not false) here does nothing (skips the preprocessor)
				if (ret) {
					content = ret;
				}
			} catch (e) {
				throw new Error(
					`Preprocessor \`${name}\` encountered an error when transforming ${inputPath}.`,
					{ cause: e },
				);
			}
		}

		return {
			skippedVia,
			content,
		};
	}
}
