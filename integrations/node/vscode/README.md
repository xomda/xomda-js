# xomda for VS Code

VS Code extension that detects `.xomda/model.json` in the workspace and exposes the xomda model and
templates inside the IDE. No backend or `@xomda/node` server required — the extension calls
[`@xomda/cli`](../../../packages/cli)'s `generate()` directly.

## Features (v1)

- **Activity-bar tool window "Xomda"** with a tree of packages → entities/enums per project and a
  flat list of every `.template.json` under `.xomda/templates/`. Click a template to open it.
- **Commands** (Command Palette):
  - `Xomda: Generate` — run codegen for the current workspace
  - `Xomda: Open Model` — open `.xomda/model.json`
  - `Xomda: Start/Stop Watching` — debounced regeneration on any change under `.xomda/`
  - `Xomda: Refresh` — reload the tree from disk
- **Multi-root workspaces** — each folder with a `.xomda/model.json` is a separate project;
  commands prompt to pick when more than one is open.
- **Activation** — `workspaceContains:**/.xomda/model.json`. Extension stays dormant in unrelated
  projects.

## Build & package

```bash
pnpm -F xomda-vscode build          # rolldown → out/extension.cjs
pnpm -F xomda-vscode package        # vsce → xomda-vscode-0.0.1.vsix
```

The extension uses `workspace:*` for every `@xomda/*` dependency. **Rolldown** (already in the repo
via Vite 8.x — do not introduce esbuild or webpack) bundles them into a single
`out/extension.cjs` at packaging time. `vscode` stays external (it's provided by the extension host
at runtime).

## Install locally

After `pnpm -F xomda-vscode package`:

```bash
code --install-extension integrations/node/vscode/xomda-vscode-0.0.1.vsix
```

Or in VS Code: **Extensions panel → … menu → Install from VSIX…**

## Tests

```bash
pnpm -F xomda-vscode test           # vitest unit tests
pnpm -F xomda-vscode test:e2e       # @vscode/test-cli — needs Electron + a display (use xvfb on CI)
```

6 vitest cases covering project discovery and recursive template walking. `test:e2e` is gated to
keep the default suite headless.

## Naming

Package name is `xomda-vscode` (no npm scope). The VS Code marketplace doesn't accept scoped names
in `package.json#name`, so this package breaks from the otherwise-uniform `@xomda/*` convention.
The marketplace ID is `xomda.xomda-vscode` (publisher `xomda` + this name).

## Two-tier MDA awareness

v1 treats `.xomda/` as user data only. The self-bootstrap pattern used inside the xomda repo (where
editing `.xomda/templates/*` regenerates `@xomda/core`) is not surfaced in the UI — that would
confuse end users and couple plugin releases to core regen cycles.
