# xomda for IntelliJ

IntelliJ Platform plugin that adds an "Xomda" tool window — analogous to the Gradle/Maven tool
windows — for projects containing a `.xomda/model.json`.

## Features (v1)

- **Right-anchored "Xomda" tool window**, registered via `XomdaToolWindowFactory` and only shown
  on projects where `.xomda/model.json` exists. Hidden in unrelated projects.
- **Tree:** model name + version → packages → entities/enums (recursive). Followed by a flat list
  of every `.template.json` under `.xomda/templates/`. Refresh button reloads from disk.
- **Generate action** (`Tools → Xomda → Generate`, plus a tool-window button). Runs
  [`XomdaGenerator`](../generator-core/src/main/java/org/xomda/generator/XomdaGenerator.java) from
  [`xomda-generator-core`](../generator-core) inside an IntelliJ `Task.Backgroundable`. After
  finishing, marks the affected VFS dirty so generated files appear in the Project view
  immediately. Notifications go through a dedicated `Xomda` balloon group.
- **Model parsing** via [`XomdaModelReader`](./src/main/kotlin/org/xomda/intellij/XomdaModelReader.kt)
  — a tolerant Jackson reader that surfaces only what the tree needs and ignores unknown fields.
  The authoritative schema still lives on the TS side in `@xomda/core`.

## Build & test

The plugin consumes `xomda-generator-core` from the project-local Maven file repo at
`integrations/jvm/.m2-repo/`. Populate it first (or use `pnpm test:jvm` which chains both steps):

```bash
pnpm test:jvm:install-core              # publish generator-core to .m2-repo
gradle -p integrations/jvm/intellij test       # 4 JUnit 5 tests
gradle -p integrations/jvm/intellij buildPlugin
# → build/distributions/xomda-intellij-plugin-0.0.1-SNAPSHOT.zip
gradle -p integrations/jvm/intellij runIde     # sandbox IDE
```

## Install

After `buildPlugin`, in IntelliJ IDEA:

**Settings → Plugins → ⚙ → Install Plugin from Disk… → select the .zip from
`build/distributions/`**

## Tech stack

- **Kotlin 2.1.20**, JDK **21** (required by IntelliJ Platform 2024.2.4).
- **IntelliJ Platform Gradle Plugin v2** (`org.jetbrains.intellij.platform` 2.2.1) — v1 is
  deprecated.
- Targets **IntelliJ IDEA Community 2024.2.4**; `sinceBuild = 242`, `untilBuild = 243.*`.
- `kotlin.stdlib.default.dependency = false` in `gradle.properties` so the Kotlin Gradle plugin
  doesn't conflict with the stdlib bundled by the IntelliJ Platform.
- `layout.buildDirectory = layout.projectDirectory.dir("build")` set explicitly.

## Tests are pure JUnit 5 — no IntelliJ Platform fixtures

The plugin's tests cover pure-logic classes (`XomdaProjectInfo`, `XomdaModelReader`). Adding
`TestFrameworkType.Platform` would pull in a `JUnit5TestSessionListener` that depends on the legacy
JUnit 3/4 `junit.framework.TestCase` — extra dependencies just to run two pure unit-test classes.
Add the test framework back when tests actually drive the IntelliJ Platform.

## Two-tier MDA awareness

v1 treats `.xomda/` as user data only. Same policy as the VS Code extension — see
[`../../node/vscode/README.md`](../../node/vscode/README.md).
