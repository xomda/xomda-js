# @xomda/unplugin

Build-tool adapter for xomda. Wires `xomda generate` into Vite, Rollup, webpack, esbuild, or
Rspack so the build watches `.xomda/` and regenerates code automatically.

## Install

```bash
pnpm add -D @xomda/unplugin
```

## Use it

### Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { XomdaPlugin } from '@xomda/unplugin'

export default defineConfig({
  plugins: [XomdaPlugin.vite({ mode: 'always' })],
})
```

### Rollup / webpack / esbuild / Rspack

```ts
import { XomdaPlugin } from '@xomda/unplugin'

XomdaPlugin.rollup(options)
XomdaPlugin.webpack(options)
XomdaPlugin.esbuild(options)
XomdaPlugin.rspack(options)
```

## Options

| Option   | Type                             | Default         | Effect                                          |
| -------- | -------------------------------- | --------------- | ----------------------------------------------- |
| `root`   | `string`                         | `process.cwd()` | Project root containing `.xomda/`               |
| `output` | `string`                         | (root)          | Directory (relative to root) for generated code |
| `mode`   | `'build' \| 'serve' \| 'always'` | `'build'`       | When to run generation (see below)              |

### `mode` semantics

- `'build'` — run once at `buildStart`. Watch-mode file changes do nothing.
- `'serve'` — skip `buildStart`. Re-run on every change under `.xomda/` or to any `.template.json`.
- `'always'` — run at `buildStart` _and_ on each relevant watch change.

## Reuse map

This package is a thin wrapper. The actual generation logic lives in:

- [`@xomda/cli`](../../../packages/cli) — exports `generate(root, options)`
- [`@xomda/template`](../../../packages/template) — Handlebars engine + cell processors
- [`@xomda/core`](../../../packages/core) — Zod schemas + constants

## Bonus: `xomdaStylesPlugin`

A separate Vite plugin exported from `@xomda/unplugin/styles`. In dev mode it replaces the bundled
`<pkg>/style.css` exports of workspace packages with an empty stub. Each package's components
import their own scoped CSS modules at the call site, so the bundled stylesheet is only needed for
production library builds. Used inside this repo's [`@xomda/client`](../../../packages/client).

```ts
import { xomdaStylesPlugin } from '@xomda/unplugin/styles'

xomdaStylesPlugin({
  packages: {
    '@xomda/ui': resolve(__dirname, '../ui/src'),
    '@xomda/icons': resolve(__dirname, '../icons/src'),
  },
})
```

## Tests

```bash
pnpm -F @xomda/unplugin test
```

21 vitest cases covering both `XomdaPlugin` (mocked `@xomda/cli`) and `xomdaStylesPlugin`.
