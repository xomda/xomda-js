# Publishing

The repo ships **one** public npm package — `xomda-js` — bundled from every
internal `@xomda/*` workspace package. The internal packages are workspace-private
(`"private": true`) and never published individually. (The published name is
`xomda-js` because npm rejected `xomda` as too similar to the existing
`ramda`. The installed CLI binary is still `xomda`.)

## Architecture

```
target/npm/                              build output (gitignored)
├── xomda-js/                            staged tarball root
│   ├── package.json                     generated — see source-of-truth below
│   ├── README.md                        rendered from README.template.md
│   ├── LICENSE
│   ├── dist/cli.js                      Vite-bundled CLI (#!/usr/bin/env node, executable)
│   ├── client/                          pre-built SPA + vendor.manifest.json
│   └── docs/.ai/                        AI-targeted docs (see AGENTS.md rule §22)
└── xomda-<version>.tgz                  what gets npm-published
```

Source of truth for the bundle build:

- [`packages/xomda/src/bin.ts`](../packages/xomda/src/bin.ts) — CLI entry. Subcommands: `serve` (default),
  `generate`, `preview`, `diff`, `wrapper`. Imports `startServer` from `@xomda/node` and
  `generate`/`preview`/`diff`/`wrapper` from `@xomda/cli`.
- [`packages/xomda/vite.config.ts`](../packages/xomda/vite.config.ts) — Vite library mode bundling
  `bin.ts` → `dist/cli.js`. Externals: `commander`, `@trpc/server`, every `node:*`. Everything else
  (incl. all `@xomda/*` workspace code) is inlined.
- [`packages/xomda/package.template.json`](../packages/xomda/package.template.json) +
  [`README.template.md`](../packages/xomda/README.template.md) — stable fields. Per-release fields
  (version, author, repository, …) are merged in from root `package.json` so version sync flows
  through one file.
- [`packages/xomda/scripts/build.ts`](../packages/xomda/scripts/build.ts) — orchestrator. Run via
  `pnpm build:publish`.

## SPA externalization contract

The SPA externalizes packages listed in
[`packages/client/vite-plugins/externals.ts`](../packages/client/vite-plugins/externals.ts)
(`PUBLISH_EXTERNALS`). At publish-build time (`XOMDA_BUILD=publish`) the publish plugin:

1. Tells Rollup to leave those packages external (not inlined into the SPA).
2. Injects a `<script type="importmap">` into `index.html` mapping each bare specifier to
   `/vendor/<pkg>/…`.
3. Emits `dist/vendor.manifest.json` listing absolute on-disk paths to each externalized package's
   root.

The runtime server reads the manifest on startup and serves `/vendor/<pkg>/<deep-path>` by resolving
inside that package's root in its own `node_modules`. So **every package in `PUBLISH_EXTERNALS` must
also be a runtime `dependency` in `packages/xomda/package.template.json`** — the build script verifies
this and fails the build if a new external slips through without a paired dep entry.

**Monaco stays bundled.** Its `?worker` imports in
[`packages/codeeditor/src/monaco.ts`](../packages/codeeditor/src/monaco.ts) are a Vite-bundle-time
convention; externalizing it would break workers in the browser. Don't add `monaco-editor` to
`PUBLISH_EXTERNALS`.

**Vuetify CSS stays bundled.** It's compiled from the user's `settings.scss` theme at SPA build time.
Only the Vuetify JS is externalized.

## Tests

`pnpm -F xomda test` runs two suites:

- `build.spec.ts` — runs the build once, then asserts staged-tree structure, package.json fields,
  tarball entries (no node_modules, no .ts source, no test files leaking), and bundle-content
  invariants (commander/`@trpc/server` external, `node:*` external, `@xomda/*` inlined, importmap
  present).
- `install-smoke.spec.ts` — slower: `npm install <tarball>` into a tmpdir, spawns the installed
  binary, hits `/`, `/vendor/lodash-es/lodash.js`, deep vendor paths, `/vendor.manifest.json` (must
  404), `/trpc/`, and the SPA fallback. Set `XOMDA_SKIP_INSTALL_SMOKE=1` to skip locally.

`pnpm -F xomda test:tarball-cypress` runs the browser-level smoke: builds, installs, spawns the
binary, and runs the `smoke/tarball.cy.ts` Cypress spec against it. Needed for releases; not part of
the default test loop.

## Publish workflow

[`.github/workflows/publish.yml`](../.github/workflows/publish.yml) is **the only path to
npmjs.com.** Triggered by `v*` tags. It runs `pnpm test` (incl. the install-smoke), then
`pnpm build:publish`, then `npm publish target/npm/xomda-js-<version>.tgz --provenance --access public
--tag <derived-tag>`. The `--provenance` flag + `id-token: write` permission unlocks npm's
verified-publisher badge.

The workflow runs the same `pnpm build:publish` script developers run locally — there is no CI-only
path. The artifact at `target/npm/xomda-js-<version>.tgz` is identical in both flows.
