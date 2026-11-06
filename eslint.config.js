import globals from "globals";
import pluginJs from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier";

export const GLOB_SRC_EXT = "?([cm])[jt]s?(x)";

export const GLOB_TESTS = [
	`**/test/**/*.${GLOB_SRC_EXT}`,
	`**/__tests__/**/*.${GLOB_SRC_EXT}`,
	`**/*.spec.${GLOB_SRC_EXT}`,
	`**/*.test.${GLOB_SRC_EXT}`,
	`**/*.bench.${GLOB_SRC_EXT}`,
	`**/*.benchmark.${GLOB_SRC_EXT}`,
];

export default [
	{
		name: "11ty/setup/js",
		...pluginJs.configs.recommended,
	},
	{
		name: "11ty/rules/project-specific",
		plugins: {
			"@stylistic/js": stylistic,
		},
		languageOptions: {
			globals: {
				...globals.node,
			},
			ecmaVersion: "latest",
			sourceType: "module",
		},
		rules: {
			"no-async-promise-executor": "warn",
			"no-prototype-builtins": "warn",
			"no-unused-vars": "warn",
			"@stylistic/js/space-unary-ops": "error",
		},
	},
	{
		name: "11ty/ignores",
		files: GLOB_TESTS,
		rules: {
			"no-unused-vars": "off",
		},
	},
	{
		name: "11ty/setup/prettier",
		...prettier,
	},
];
