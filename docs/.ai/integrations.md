# IDE & build integrations — AI quick reference

Rules for working under `integrations/`. The general TS rules in
`AGENTS.md` still apply to `integrations/node/*`; this file collects the
integration-specific constraints that would otherwise inflate the
always-loaded `AGENTS.md`.

## TypeScript (`integrations/node/*`)

1. **VS Code extension consumes `@xomda/*` via `workspace:*`**, never
   published versions. Bug fixes flow immediately. `rolldown` (already
   in repo via Vite 8.x — do NOT add esbuild/webpack) bundles workspace
   deps into a single `out/extension.cjs` at packaging. `vscode` is the
   only declared external (provided by extension host at runtime).
2. **No `outDir` in `tsconfig.json` when extending root.** Root config
   has `paths` into other packages' `src/`. Setting explicit `outDir`
   pins `rootDir` to the current project → errors on every
   path-mapped import as "outside `rootDir`". Leave `outDir` off;
   rolldown emits.

## JVM (`integrations/jvm/*`)

3. **All Gradle modules under `integrations/jvm/` pin
   `layout.buildDirectory`:**
   ```kotlin
   layout.buildDirectory = layout.projectDirectory.dir("build")
   ```
   Defends against IDEs picking adjacent folders (especially `lib/`) as
   default compile-output sink — original reason we moved off `lib/`.
4. **JVM plugins consume `xomda-generator-core` from
   `integrations/jvm/.m2-repo/`**, never `~/.m2/`. Populated by
   `pnpm test:jvm:install-core` (or inline:
   `mvn -f integrations/jvm/generator-core install -Dmaven.repo.local=$PWD/integrations/jvm/.m2-repo`).
   Use `-Dmaven.repo.local`, not `-DaltDeploymentRepository` (that's
   for `deploy`, not `install`). Keeps clean checkouts reproducible.
5. **The Maven aggregator covers Maven modules only.** Adding
   Gradle/IntelliJ to it would be invalid (they're Gradle). Eclipse
   has its own aggregator at `integrations/jvm/eclipse/pom.xml`.
   `pnpm test:jvm` chains all four (Maven aggregator + Gradle +
   IntelliJ + Eclipse).

## Cross-cutting

6. **IDE plugins treat `.xomda/` as user data only.** Don't surface the
   meta-model self-bootstrap pattern (used inside xomda repo for
   regenerating `@xomda/core` from `.xomda/templates/`) in plugin UI.
   Would confuse end users and couple plugin releases to core regen.
   Revisit only on a real user ask.
7. **Don't add per-plugin npm directories to
   `.github/dependabot.yml`.** Root `/` npm scan already covers the
   workspace; per-package entries duplicate PRs.
8. **JVM plugin tests stay JUnit 5 unless they need IntelliJ Platform
   fixtures.** Adding `TestFrameworkType.Platform` to IntelliJ plugin
   deps pulls a session listener that requires legacy
   `junit.framework.TestCase` (JUnit 3/4). Revisit only when a test
   actually drives IntelliJ Platform — pure-logic unit tests
   (`XomdaProjectInfo`, `XomdaModelReader`) don't.
