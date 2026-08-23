<p align="center"><img src="./docs/ba-11ty-logo.png" width="200" height="200" alt="Build Awesome (balloon) and 11ty Logo"></p>

# Build Awesome (Eleventy) 🕚⚡️🎈🐀

A simpler static site generator. An alternative to Jekyll. Written in JavaScript. Transforms a directory of templates (of varying types) into HTML.

Works with HTML, Markdown, JavaScript, Liquid, Nunjucks, with addons for WebC, Sass, Vue, Svelte, TypeScript, JSX, and many others!

## ➡ [Documentation](https://www.11ty.dev/docs/)

- Star [this repo on GitHub](https://github.com/11ty/buildawesome/)!
- Follow us [on Mastodon `@11ty@neighborhood.11ty.dev`](https://neighborhood.11ty.dev/@11ty)
- Follow us [on Bluesky `@11ty.dev`](https://bsky.app/profile/11ty.dev)
- Install [from npm](https://www.npmjs.com/org/11ty)
- Follow [on GitHub](https://github.com/11ty)
- Watch us [on YouTube](https://www.youtube.com/c/EleventyVideo)
- Chat on [Discord](https://www.11ty.dev/blog/discord/)
- Latest: [![npm Version](https://img.shields.io/npm/v/@11ty/eleventy.svg?style=for-the-badge)](https://www.npmjs.com/package/@11ty/eleventy)

## Installation

```
npm install @awesome.me/buildawesome --save-dev

# Backwards compatible here too:
npm install @11ty/eleventy --save-dev
```

Read our [Getting Started guide](https://www.11ty.dev/docs/getting-started/).

## Tests

```
npm test
```

We have a few test suites, for various reasons:

- [ava JavaScript test runner](https://github.com/avajs/ava) ([assertions docs](https://github.com/avajs/ava/blob/main/docs/03-assertions.md)) (primary test suite in `test/`)
- [Node.js Test runner](https://nodejs.org/api/test.html) (secondary test suite in `test_node/`)
- [Vitest (in Browser Mode)](https://vitest.dev/guide/browser/) (browser tests in `packages/browser/test/`)
- [Benchmark for Performance Regressions](https://github.com/11ty/buildbenchmark)

These run in various environments:

- [Continuous Integration on GitHub Actions](https://github.com/11ty/buildawesome/actions/workflows/ci.yml)
- [Code Coverage Statistics](https://github.com/11ty/buildawesome/blob/master/docs/coverage.md)

## Community Roadmap

- [Top Feature Requests](https://github.com/11ty/buildawesome/discussions/categories/enhancement-queue?discussions_q=is%3Aopen+category%3A%22Enhancement+Queue%22+sort%3Atop) (Vote for your favorites!)
- [Top Bugs 😱](https://github.com/11ty/buildawesome/issues?q=is%3Aissue+is%3Aopen+label%3Abug+sort%3Areactions) (Add your own votes using the 👍 reaction)

## Plugins

See the [official docs on plugins](https://www.11ty.dev/docs/plugins/).
