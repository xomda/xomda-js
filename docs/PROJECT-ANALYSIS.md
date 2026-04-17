# Project Analysis

This document describes the project-analysis subsystem: the framework that inspects an opened project to detect
which technologies, build tools, and editors are in use. It informs the homepage tech chips, file-browser icons,
preview routing, and project-context detection.

For the broader package layout, see [Architecture](./ARCHITECTURE.md).

## How it works

Each analysis plugin contributes a **manifest** with everything xomda needs to know about its slice of the
project — how to detect it, what files it claims, what icons and previews to render, and (optionally) what kind
of project it owns.

When xomda's backend starts, every plugin **self-registers** at import time into a singleton registry in
`@xomda/analysis-core`. A meta-package `@xomda/analysis-plugins` side-effect-imports every plugin so a single
`import '@xomda/analysis-plugins'` populates the entire registry. The client mirrors this through
`@xomda/analysis-plugins-client`.

Detection runs on demand (homepage scan, Settings "Refresh detection", explicit tRPC call). The expensive
filesystem-walking version runs inside a `worker_thread` so the tRPC event loop doesn't block.

## Plugin contract

A plugin lives in its own workspace package at `packages/analysis/<name>/` and ships **both halves** of the
contract:

```
packages/analysis/<name>/
  src/index.ts       node-side: detect / inspect / fileTypes / projectKind
  src/client.ts      browser-side: icon + optional custom preview components
  package.json       exports: { ".": "./src/index.ts", "./client": "./src/client.ts" }
```

### Node side (`AnalysisPlugin`)

```ts
interface AnalysisPlugin {
  id: string // matches the client manifest's id
  name: string // display name
  icon?: string // logical icon id (resolved by the client)
  patterns?: DetectionPattern[] // file-exists / file-content shorthand
  detect?: (ctx) => boolean | Promise<boolean> // custom detection
  inspect?: (ctx) => Promise<PluginMatch | null> // structured details (roots, refs, …)
  fileTypes?: FileTypeDescriptor[] // which paths this plugin claims (icons, previews)
  projectKind?: ProjectKindContribution // marker, loadMeta, listSubprojects hooks
}
```

Each plugin's `src/index.ts` ends with `registerAnalysisPlugin(myPlugin)`. Detection runs via
`ProjectAnalyzer.analyze(rootPath)` (see [`@xomda/analysis-core`](../packages/analysis/core/src/analyzer.ts));
the result is a list of `DetectedFeature` carrying back `icon`, `fileTypes`, and the optional `match` from
`inspect`.

### Client side (`AnalysisPluginClient`)

```ts
interface AnalysisPluginClient {
  id: string // pairs with AnalysisPlugin.id
  icon?: string // SVG path from @xomda/icons
  color?: string // optional accent
  previewComponents?: Record<string, Component>
}
```

Each plugin's `src/client.ts` ends with `registerAnalysisPluginClient(myClient)`. The Vue app imports
`@xomda/analysis-plugins-client` once in `main.ts`; from there, `getIconForPlugin(id)` and
`getPreviewComponent(componentId)` resolve everything the views need.

The **id-parity** spec in `@xomda/analysis-plugins-client` guards against drift: every node-side plugin must
have a client counterpart with the same id and an icon, and vice versa.

### Multi-match by design

`fileTypesFor(path)` returns **every** descriptor across all plugins that claims a path. A `.ts` file inside
a Vite project matches both the TypeScript and Vite plugins; the file browser renders both icons via the
generic `MultiIcon` component in `@xomda/ui`. Preview routing picks the descriptor with the highest
`priority` (ties → first registered), so an overlay-only plugin like Vite contributes an icon without
overriding the language preview.

## Project kinds

A plugin marks itself as owning a project kind by setting `projectKind`:

```ts
projectKind: {
  marker: '.xomda',                    // dir/file presence flags ownership
  loadMeta: (root) => readMeta(root),  // → { name, description? }
  hooks: {
    listSubprojects: (root) => [...]   // recursive shallow walk, ignore-list aware
  }
}
```

The `xomdaPlugin` owns `.xomda` ownership today. The `project.context` tRPC procedure uses this to answer
"am I in a project root / subfolder / nowhere?" and `scan` uses `listSubprojects` to enumerate nested
projects.

## Active-plugin filter

`.xomda/project.json` carries a sorted `plugins: string[]` field. When non-empty, scan and `fileTypesFor`
filter their output to that allowlist; when empty (the default before the first refresh), every detected
plugin contributes. Users edit the list via the Settings page; the **Refresh detection** button replaces
it with the freshly detected set.

The sorted-by-schema invariant keeps `project.json` diffs minimal — adding or removing one plugin moves at
most one line.

## tRPC surface

All under `appRouter.project` ([packages/model/src/router/project.router.ts](../packages/model/src/router/project.router.ts)):

| Procedure        | Kind     | Purpose                                                            |
| ---------------- | -------- | ------------------------------------------------------------------ |
| `context`        | query    | Walk up from a path looking for the project marker                 |
| `meta`           | query    | Read `.xomda/project.json`                                         |
| `updateMeta`     | mutation | Write `.xomda/project.json` (sandbox / plugins list / metadata)    |
| `scan`           | query    | Full detection inside a worker_thread (+ subprojects, detectedIds) |
| `fileTypesFor`   | query    | Multi-match descriptors + resolved preview hint for one path       |
| `refreshPlugins` | mutation | Re-run detection and persist the result into `project.plugins`     |
| `listPlugins`    | query    | Every plugin known to the server (id + display name)               |

The legacy `appRouter.analysis.detect` / `listPlugins` still exists for backward compatibility.

## Plugins

| Id              | Package                               | Marker / detection                                  |
| --------------- | ------------------------------------- | --------------------------------------------------- |
| `xomda`         | `@xomda/plugin-analysis-xomda`        | `.xomda/` directory; owns the xomda project kind    |
| `typescript`    | `@xomda/plugin-analysis-typescript`   | `tsconfig.json` + `inspect` (references, roots)     |
| `vite`          | `@xomda/plugin-analysis-vite`         | `vite.config.*`; overlays icon on `.ts`/`.js`       |
| `maven`         | `@xomda/plugin-analysis-maven`        | `pom.xml` + `inspect` (source / test roots)         |
| `gradle`        | `@xomda/plugin-analysis-gradle`       | `build.gradle{,.kts}`, `settings.gradle{,.kts}`     |
| `ant`           | `@xomda/plugin-analysis-ant`          | `build.xml`                                         |
| `eslint`        | `@xomda/plugin-analysis-eslint`       | `.eslintrc.*` / `eslint.config.*` (decorative only) |
| `prettier`      | `@xomda/plugin-analysis-prettier`     | `.prettierrc.*` / `prettier.config.*`               |
| `stylelint`     | `@xomda/plugin-analysis-stylelint`    | `.stylelintrc.*` / `stylelint.config.*`             |
| `rust`          | `@xomda/plugin-analysis-rust`         | `Cargo.toml`                                        |
| `webpack`       | `@xomda/plugin-analysis-webpack`      | `webpack.config.*`                                  |
| `intellij`      | `@xomda/plugin-analysis-intellij`     | `.idea/`                                            |
| `vscode`        | `@xomda/plugin-analysis-vscode`       | `.vscode/`                                          |
| `visual-studio` | `@xomda/plugin-analysis-visualstudio` | `*.sln`, `*.csproj`, `*.vbproj`                     |

## Adding a new plugin

1. Create `packages/analysis/<name>/` with the standard `src/index.ts` + `src/client.ts` pair and the
   `./client` package export (copy any existing plugin, e.g. `vite`, as template).
2. Pick a logical icon id from `@xomda/icons` (or add a new `PluginXxxIcon` if none fit).
3. Add one import line in `packages/analysis/plugins/src/index.ts` and one in
   `packages/analysis/plugins-client/src/index.ts`.
4. Add the package as a workspace dep of both aggregators.
5. Optional: declare `fileTypes` (icons appear in the file browser), `inspect` (structured project details),
   `projectKind` (own a marker).

The aggregator-spec and id-parity-spec tests will pick up the new plugin automatically.

## See also

- [Architecture](./ARCHITECTURE.md) — where the analysis packages sit in the dependency graph.
- [API](./api.md) — full tRPC reference, including `project.*` and `analysis.*` namespaces.
