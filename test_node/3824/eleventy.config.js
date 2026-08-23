import { register } from "tsx/esm/api";

import { jsxToString } from "jsx-async-runtime";
// import { renderToStaticMarkup } from "react-dom/server";

export default async function (configApi) {
	configApi.addExtension(["11ty.jsx", "11ty.ts", "11ty.tsx"], {
		key: "11ty.js",
		compile: async function (inputContent, inputPath) {
			this.addDependencies(inputPath, ["./test_node/3824/_includes/head.tsx"]);

			return async function (data) {
				let content = await this.defaultRenderer(data);
				return jsxToString(content);
				// return renderToStaticMarkup(content);
			};
		},
	});

	configApi.addTemplateFormats(["11ty.jsx", "11ty.tsx"]);

	let unregister;
	configApi.on("buildawesome.before", () => {
		unregister = register({
			// custom tsconfig
			tsconfig: "test_node/3824/tsconfig-3824.json",
		});
	});
	configApi.on("buildawesome.after", () => {
		unregister();
	});
}
