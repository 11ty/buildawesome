# `@awesome.me/ba-datawriter`

Write a single value into a JSON data file or a template’s front matter.

The write is **surgical**: it replaces the smallest possible span of source text, so
comments, key order, quoting style, blank lines and indentation elsewhere in the file are
byte-identical afterwards. When an edit cannot be made without reformatting, it throws
instead of silently rewriting the file.

```js
import { DataWriter } from "@awesome.me/ba-datawriter";

DataWriter.write("./_data/site.json", "nav[1].title", "About Us");
DataWriter.write("./posts/first.md", "seo.description", "A new description");
```

## `DataWriter.write(filePath, selector, value, options)`

Synchronous, and therefore also safe to `await`.

The mode is chosen by file extension:

| Extension                               | Behavior                                                 |
| --------------------------------------- | -------------------------------------------------------- |
| `.json`                                 | The whole file is the data document                      |
| `.js` `.cjs` `.mjs` `.ts` `.cts` `.mts` | Reserved — throws “not yet supported”                    |
| anything else                           | Edits the front matter block, leaving the body untouched |

Missing files are created. A file with no front matter gets a block prepended, in
`options.format` (`"yaml"` by default, or `"json"`). An existing block always keeps its own
language, including its `---json` tag.

Returns `{ path, selector, value, previousValue, created, written }`. `written` is `false`
when the value was already what you asked for — nothing is written to disk in that case.

### Options

- **`format`** — `"yaml"` (default) or `"json"`. Only applies when a front matter block is
  being created.
- **`reservedKeys`** — property names to refuse. Defaults to the data properties Eleventy
  supplies itself (`pkg`, `eleventy`, `content`, `page.url`, …), because writing one produces
  a file that is silently overwritten on the next build. Pass `[]` to disable the check when
  using this outside of Eleventy.

## When it refuses

Front matter is editable in `yaml` and `json` only; `js` and `toml` blocks throw.

Within YAML, some shapes cannot be edited without reformatting, and are refused rather than
rewritten: paths through an alias (`*ref`) or a merge key (`<<:`), nodes carrying an explicit
tag, replacing a whole mapping or sequence, inserting into a flow collection (`{ … }`),
ambiguous duplicate keys, and replacing a block scalar with a non-string.

## Caveats

- Comments _inside_ the front matter block are preserved, but a value that has to be
  re-rendered adopts the serializer’s quoting for that one value.
- Custom front matter delimiters (e.g. `+++`) are not supported.
- Writing a data file during `--watch` retriggers a build. Because an unchanged value
  short-circuits without touching disk, an idempotent write settles after one extra build.
