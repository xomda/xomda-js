# Integrations

Adapters between xomda and external ecosystems — build tools (Maven, Gradle, Vite/Rollup/webpack)
and IDEs (VS Code, IntelliJ, Eclipse).

Everything under [`packages/`](../packages) is a platform library that the rest of the system builds on.
Everything under `integrations/` is the other direction: code that consumes those libraries and
exposes xomda inside someone else's tool. Integrations import from `packages/`, never the other way
around.

## Layout

Grouped by language first, then purpose — sibling plugins in the same language share code naturally
via their language's package system.

```
integrations/
├── node/                       TypeScript integrations
│   ├── unplugin/               Vite / Rollup / webpack / esbuild adapter
│   └── vscode/                 VS Code extension (xomda-vscode)
└── jvm/                        JVM integrations
    ├── generator-core/         Java codegen engine — equivalent of @xomda/template
    ├── gradle/                 Gradle build plugin
    ├── maven/                  Maven plugin
    ├── intellij/               IntelliJ Platform plugin (Kotlin)
    ├── eclipse/                Eclipse plugin (Tycho)
    ├── .m2-repo/               [gitignored] project-local Maven repo for generator-core
    └── pom.xml                 Maven aggregator (generator-core + maven plugin only)
```

## Code-sharing pattern

The TS and JVM sides are two parallel implementations of the same generation pipeline, kept in sync
at the **file-format level** (`.xomda/model.json` + `.xomda/templates/*.template.json`).

- **TS plugins** consume `@xomda/core`, `@xomda/template`, `@xomda/cli` via `workspace:*`. Bug fixes
  in the libraries flow into the plugins immediately; the VS Code extension bundles them into its
  `.vsix` at packaging time with rolldown.
- **JVM plugins** all depend on `xomda-generator-core`. They consume it from the project-local Maven
  file repo at `integrations/jvm/.m2-repo/`, populated by `pnpm test:jvm:install-core`. Same idea as
  the TS side: bug fixes in generator-core flow through after a re-install of the local repo.

## Building & testing

From the repo root:

```bash
pnpm test           # TS test suite (covers unplugin + vscode along with the libraries)
pnpm test:jvm       # JVM builds + tests: install-core → maven aggregator → gradle → intellij → eclipse
pnpm test:all       # TS first, then JVM — fast-fail before the slow JVM downloads
```

The Maven aggregator at [`jvm/pom.xml`](./jvm/pom.xml) covers Maven modules only; Gradle and Eclipse
have their own toolchains, hence the separate steps.

## Adding a new integration

1. Pick the right language family (`node/` or `jvm/`).
2. Drop into the family's package layout — pnpm workspace for TS, the same project-local Maven repo
   pattern for JVM.
3. Make sure the package is wired into:
   - the relevant test orchestration ([root `vitest.config.ts`](../vitest.config.ts) projects list
     for TS, [`package.json`](../package.json) `test:jvm:*` script for JVM)
   - [`.github/dependabot.yml`](../.github/dependabot.yml) (only for new Maven or Gradle paths —
     npm scope already covered by the root entry)
4. Add a `README.md` next to the package's manifest.
5. For Gradle modules, set `layout.buildDirectory = file("build")` explicitly. See the AGENTS.md
   rule under "IDE & build integrations" for the reason.

The full rules live in [`AGENTS.md`](../AGENTS.md) — search for "IDE & build integrations".
