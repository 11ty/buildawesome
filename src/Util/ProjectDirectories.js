import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { TemplatePath } from "@11ty/eleventy-utils";
import { isDynamicPattern } from "../Util/GlobMatcher.js";

import DirContains from "./DirContains.js";

/* Directories internally should always use *nix forward slashes */
export default class ProjectDirectories {
	static defaults = {
		input: "./",
		data: "./_data/", // Relative to input directory
		includes: "./_includes/", // Relative to input directory
		layouts: "./_layouts/", // Relative to input directory
		output: "./_site/",
	};

	// no updates allowed, input/output set via CLI
	#frozen = false;

	// When true, explicitly configured data/includes/layouts are relative to the project root
	#relativeToProjectRoot = false;

	#raw = {};

	#dirs = {};

	inputFile = undefined;
	inputGlob = undefined;

	static relativeToProjectRoot(fileOrDir) {
		return this.normalizePath(TemplatePath.relativePath(fileOrDir));
	}

	// Add leading dot slash
	// Use forward slashes
	static normalizePath(fileOrDir) {
		return TemplatePath.standardizeFilePath(fileOrDir);
	}

	// Must be a directory
	// Always include a trailing slash
	static normalizeDirectory(dir) {
		return this.addTrailingSlash(this.normalizePath(dir));
	}

	normalizeDirectoryPathRelativeToInputDirectory(filePath) {
		return ProjectDirectories.normalizeDirectory(
			path.join(this.#relativeToProjectRoot ? "" : this.input, filePath),
		);
	}

	static addTrailingSlash(path) {
		if (path.slice(-1) === "/") {
			return path;
		}
		return path + "/";
	}

	// If input/output are set via CLI, they take precedence over all other configuration values.
	freeze() {
		this.#frozen = true;
	}

	setViaConfigObject(configDirs = {}) {
		// input must come last
		let inputChanged = false;
		if (
			configDirs.input &&
			ProjectDirectories.normalizeDirectory(configDirs.input) !== this.input
		) {
			this.#setInputRaw(configDirs.input);
			inputChanged = true;
		}

		// If falsy or an empty string, the current directory is used.
		if (configDirs.output !== undefined) {
			if (ProjectDirectories.normalizeDirectory(configDirs.output) !== this.output) {
				this.setOutput(configDirs.output);
			}
		}

		// Input relative directory, if falsy or an empty string, inputDir is used!
		// Always set if input changed, e.g. input is `src` and data is `../_data` (resulting in `./_data`) we still want to set data to this new value
		if (configDirs.data !== undefined) {
			if (
				inputChanged ||
				this.normalizeDirectoryPathRelativeToInputDirectory(configDirs.data || "") !== this.data
			) {
				this.setData(configDirs.data);
			}
		}

		// Input relative directory, if falsy or an empty string, inputDir is used!
		if (configDirs.includes !== undefined) {
			if (
				inputChanged ||
				this.normalizeDirectoryPathRelativeToInputDirectory(configDirs.includes || "") !==
					this.includes
			) {
				this.setIncludes(configDirs.includes);
			}
		}

		// Input relative directory, if falsy or an empty string, inputDir is used!
		if (configDirs.layouts !== undefined) {
			if (
				inputChanged ||
				this.normalizeDirectoryPathRelativeToInputDirectory(configDirs.layouts || "") !==
					this.layouts
			) {
				this.setLayouts(configDirs.layouts);
			}
		}

		if (inputChanged) {
			this.updateInputDependencies();
		}
	}

	setRelativeToProjectRoot(bool) {
		this.#relativeToProjectRoot = Boolean(bool);
		this.updateInputDependencies();
	}

	isRelativeToProjectRoot(name) {
		return this.#relativeToProjectRoot && this.#raw[name] !== undefined;
	}

	updateInputDependencies() {
		this.#resolve("data");
		this.#resolve("includes");

		// Should not include this if not explicitly opted-in
		if (this.#raw.layouts !== undefined) {
			this.#resolve("layouts");
		}
	}

	// Defaults are always input-relative, explicit values follow `#relativeToProjectRoot`
	#resolve(name) {
		let dir = this.#raw[name] ?? ProjectDirectories.defaults[name];
		let base = this.isRelativeToProjectRoot(name) ? "" : this.input;
		// falsy or an empty string is valid (falls back to the base directory)
		this.#dirs[name] = ProjectDirectories.normalizeDirectory(TemplatePath.join(base, dir || ""));
	}

	/* Relative to project root, must exist */
	#setInputRaw(dirOrFile, inputDir = undefined) {
		// is frozen and was defined previously
		if (this.#frozen && this.#raw.input !== undefined) {
			return;
		}

		this.#raw.input = dirOrFile;

		if (!dirOrFile) {
			// input must exist if inputDir is not set.
			return;
		}

		// Normalize absolute paths to relative, #3805 #3896
		if (path.isAbsolute(dirOrFile)) {
			dirOrFile = path.relative(".", dirOrFile);
		}

		// Input has to exist (assumed glob if it does not exist)
		let inputExists = existsSync(dirOrFile);
		let inputExistsAndIsDirectory = inputExists && statSync(dirOrFile).isDirectory();

		if (inputExistsAndIsDirectory) {
			// is not a file or glob
			this.#dirs.input = ProjectDirectories.normalizeDirectory(dirOrFile);
		} else {
			if (inputExists) {
				this.inputFile = ProjectDirectories.normalizePath(dirOrFile);
			} else {
				if (!isDynamicPattern(dirOrFile)) {
					throw new Error(
						`The "${dirOrFile}" \`input\` parameter (directory or file path) must exist on the file system (unless detected as a glob by the \`tinyglobby\` package)`,
					);
				}

				this.inputGlob = dirOrFile;
			}

			// Explicit Eleventy option for inputDir
			if (inputDir) {
				// Changed in 3.0: must exist
				if (!existsSync(inputDir)) {
					throw new Error("Directory must exist (via inputDir option to Eleventy constructor).");
				}

				this.#dirs.input = ProjectDirectories.normalizeDirectory(inputDir);
			} else {
				// the input directory is implied to be the parent directory of the
				// file, unless inputDir is explicitly specified (via Eleventy constructor `options`)
				this.#dirs.input = ProjectDirectories.normalizeDirectory(
					TemplatePath.getDirFromFilePath(dirOrFile), // works with globs
				);
			}
		}
	}

	setInput(dirOrFile, inputDir = undefined) {
		this.#setInputRaw(dirOrFile, inputDir); // does not update
		this.updateInputDependencies();
	}

	/* Relative to input dir (or project root) */
	setIncludes(dir) {
		if (dir !== undefined) {
			this.#raw.includes = dir;
			this.#resolve("includes");
		}
	}

	/* Relative to input dir (or project root) */
	/* Optional */
	setLayouts(dir) {
		if (dir !== undefined) {
			this.#raw.layouts = dir;
			this.#resolve("layouts");
		}
	}

	/* Relative to input dir (or project root) */
	// TODO must exist if specified
	setData(dir) {
		if (dir !== undefined) {
			this.#raw.data = dir;
			this.#resolve("data");
		}
	}

	/* Relative to project root */
	setOutput(dir) {
		// is frozen and was defined previously
		if (this.#frozen && this.#raw.output !== undefined) {
			return;
		}

		if (dir !== undefined) {
			this.#raw.output = dir;

			// Normalize absolute paths to relative, #3805 #3896
			if (path.isAbsolute(dir)) {
				dir = path.relative(".", dir);
			}

			this.#dirs.output = ProjectDirectories.normalizeDirectory(dir || "");
		}
	}

	// Configured directories must match on-disk casing, since only some file systems ignore case
	checkCase(existsCache) {
		let paths = {
			input: this.inputFile || this.input,
			data: this.data,
			includes: this.includes,
			layouts: this.layouts,
			output: this.output,
		};
		for (let [name, dir] of Object.entries(paths)) {
			let resolved = dir && existsCache.resolve(dir);
			if (resolved && resolved !== dir) {
				throw new Error(
					`The \`${name}\` path "${dir}" doesn’t match the casing on disk: "${resolved}"`,
				);
			}
		}
	}

	// Catch input-relative directories that were configured as if they were project-root relative
	checkInputRelative(existsCache) {
		for (let name of ["data", "includes", "layouts"]) {
			let dir = this[name];
			let raw = this.#raw[name] ?? ProjectDirectories.defaults[name];
			if (!dir || !raw || path.isAbsolute(raw) || this.isRelativeToProjectRoot(name)) {
				continue;
			}

			let rootRelative = ProjectDirectories.normalizeDirectory(raw);
			if (
				rootRelative !== dir &&
				!existsCache.exists(dir) &&
				existsCache.isDirectory(rootRelative)
			) {
				let suggestion = ProjectDirectories.addTrailingSlash(
					TemplatePath.standardizeFilePath(path.relative(this.input, rootRelative)),
				);
				throw new Error(
					`The \`${name}\` directory is relative to the input directory: "${raw}" resolves to "${dir}", which doesn’t exist. Did you mean "${suggestion}" (resolves to "${rootRelative}")?`,
				);
			}
		}
	}

	get input() {
		return this.#dirs.input || ProjectDirectories.defaults.input;
	}

	get data() {
		return this.#dirs.data || ProjectDirectories.defaults.data;
	}

	get includes() {
		return this.#dirs.includes || ProjectDirectories.defaults.includes;
	}

	get layouts() {
		// explicit opt-in, no fallback.
		return this.#dirs.layouts;
	}

	get output() {
		return this.#dirs.output || ProjectDirectories.defaults.output;
	}

	// `filePath` is relative to the project root (e.g. a watched file) or absolute
	isTemplateFile(filePath) {
		let projectPath = ProjectDirectories.relativeToProjectRoot(filePath);
		for (let dir of [this.layouts, this.includes, this.data]) {
			// A directory that is also the input directory can’t tell us anything, so defer
			if (dir && dir !== this.input && projectPath.startsWith(dir)) {
				return false;
			}
		}

		return projectPath.startsWith(this.input);
	}

	// for a hypothetical template file
	getInputPath(filePathRelativeToInputDir) {
		// TODO change ~/ to project root dir
		return TemplatePath.addLeadingDotSlash(
			TemplatePath.join(this.input, TemplatePath.standardizeFilePath(filePathRelativeToInputDir)),
		);
	}

	// Inverse of getInputPath
	// Removes input dir from path
	getInputPathRelativeToInputDirectory(filePathRelativeToInputDir) {
		// Paths outside the input directory keep their `../` prefix to match `addTemplate` keys, #4409
		if (!DirContains(this.input, filePathRelativeToInputDir)) {
			return TemplatePath.standardizeFilePath(
				path.relative(this.input, filePathRelativeToInputDir),
			);
		}

		let inputDir = TemplatePath.addLeadingDotSlash(TemplatePath.join(this.input));

		// No leading dot slash
		return TemplatePath.stripLeadingSubPath(filePathRelativeToInputDir, inputDir);
	}

	// Removes output dir from path
	getOutputPathRelativeToOutputDirectory(filePathRelativeToRootDir) {
		let filePath = TemplatePath.addLeadingDotSlash(filePathRelativeToRootDir);
		let outputDir = TemplatePath.addLeadingDotSlash(TemplatePath.join(this.output));

		return "/" + TemplatePath.stripLeadingSubPath(filePath, outputDir);
	}

	// for a hypothetical Eleventy layout file
	getLayoutPath(filePathRelativeToLayoutDir) {
		return TemplatePath.addLeadingDotSlash(
			TemplatePath.join(
				this.layouts || this.includes,
				TemplatePath.standardizeFilePath(filePathRelativeToLayoutDir),
			),
		);
	}

	// Removes layout dir from path
	getLayoutPathRelativeToInputDirectory(filePathRelativeToLayoutDir) {
		return this.getInputPathRelativeToInputDirectory(
			this.getLayoutPath(filePathRelativeToLayoutDir),
		);
	}

	getProjectPath(filePath) {
		return TemplatePath.addLeadingDotSlash(
			TemplatePath.join(".", TemplatePath.standardizeFilePath(filePath)),
		);
	}

	isFileInProjectFolder(filePath) {
		return DirContains(TemplatePath.getWorkingDir(), filePath);
	}

	isFileInOutputFolder(filePath) {
		return DirContains(this.output, filePath);
	}

	static getRelativeTo(targetPath, cwd) {
		return path.relative(cwd, path.join(path.resolve("."), targetPath));
	}

	// Access the data without being able to set the data.
	getUserspaceInstance() {
		let d = this;

		return {
			get input() {
				return d.input;
			},
			get inputFile() {
				return d.inputFile;
			},
			get inputGlob() {
				return d.inputGlob;
			},
			get data() {
				return d.data;
			},
			get includes() {
				return d.includes;
			},
			get layouts() {
				return d.layouts;
			},
			get output() {
				return d.output;
			},
		};
	}

	toString() {
		return {
			input: this.input,
			inputFile: this.inputFile,
			inputGlob: this.inputGlob,
			data: this.data,
			includes: this.includes,
			layouts: this.layouts,
			output: this.output,
		};
	}
}
