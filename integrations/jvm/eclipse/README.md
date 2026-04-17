# xomda for Eclipse

Eclipse plugin that brings xomda into the Eclipse IDE. Built with **Tycho** so it builds from the
Maven CLI without needing an Eclipse install on the build machine.

## Features (v1)

- **"Xomda Model" workbench view** (`Window → Show View → Other → Xomda → Xomda Model`). Walks
  every open project, picks the ones with a `.xomda/model.json`, and shows a tree of packages →
  entities/enums plus all templates under `.xomda/templates/`. Plain SWT — no extra JFace deps
  beyond what `org.eclipse.ui` provides.
- **`Xomda → Generate` main-menu command**. Runs
  [`XomdaGenerator`](../generator-core/src/main/java/org/xomda/generator/XomdaGenerator.java) from
  [`xomda-generator-core`](../generator-core) inside an Eclipse `Job`, then refreshes the workspace
  so generated files appear in Package Explorer.

## Layout

Four Tycho modules. Note that Tycho requires Maven `artifactId == OSGi Bundle-SymbolicName`, so the
artifactIds use OSGi naming rather than the friendlier `xomda-eclipse-*` form.

```
integrations/jvm/eclipse/
├── pom.xml                        Tycho aggregator
├── target-platform/
│   └── xomda.target               Pinned Eclipse 2024-09 + Jackson + generator-core
├── xomda-eclipse-plugin/          org.xomda.eclipse  (eclipse-plugin)
├── xomda-eclipse-plugin.test/     org.xomda.eclipse.tests  (eclipse-test-plugin)
├── xomda-eclipse-feature/         org.xomda.eclipse.feature  (eclipse-feature)
└── xomda-eclipse-updatesite/      org.xomda.eclipse.updatesite  (eclipse-repository)
```

## Build & test

The Eclipse plugin pulls `xomda-generator-core` through its target platform's Maven location, so
`pnpm test:jvm:install-core` (which publishes generator-core into `integrations/jvm/.m2-repo/`)
must run first. The chained `pnpm test:jvm` does this automatically.

```bash
mvn -f integrations/jvm/eclipse validate    # POM + plugin descriptors only — fast
mvn -f integrations/jvm/eclipse verify      # full Tycho build + JUnit 5 via tycho-surefire
```

First-time `verify` downloads the Eclipse 2024-09 target platform (~500 MB) and caches it under
`~/.m2/repository/.cache/tycho/`. Subsequent builds are fast.

## Install

`mvn verify` produces a p2 update site at:

```
xomda-eclipse-updatesite/target/repository/
```

In Eclipse: **Help → Install New Software… → Add… → Local… → point at that folder → install the
`xomda` feature.**

## Notes & gotchas

- **Pinned target platform.** `target-platform/xomda.target` pins Eclipse 2024-09 (4.33). Without
  pinning, Tycho builds drift with whatever release is current and break randomly.
- **JDK 25 + Tycho:** the JDK's XML entity-size limits can refuse the Eclipse p2 metadata. If
  `mvn verify` complains about `jdk.xml.maxGeneralEntitySizeLimit`, run with:
  ```bash
  MAVEN_OPTS="-Djdk.xml.maxGeneralEntitySizeLimit=0 -Djdk.xml.totalEntitySizeLimit=0" \
    mvn -f integrations/jvm/eclipse verify
  ```
- **Corrupted `~/.m2`:** if your local Maven cache contains a corrupted POM (notably any
  `org/graalvm/polyglot/js` from cancelled downloads), Tycho's Maven-location resolver fails to
  wrap generator-core as a bundle. Delete the offending directory under `~/.m2/repository/` and
  re-run. CI is unaffected because it starts from a clean cache.

## Two-tier MDA awareness

v1 treats `.xomda/` as user data only. Same policy as the other two IDE plugins.

## Code duplication note

[`XomdaProjectInfo.java`](./xomda-eclipse-plugin/src/org/xomda/eclipse/XomdaProjectInfo.java) and
[`XomdaModelReader.java`](./xomda-eclipse-plugin/src/org/xomda/eclipse/XomdaModelReader.java) are
near-duplicates of the IntelliJ plugin's Kotlin equivalents. We accept this minor duplication
rather than introducing a third shared JVM module for two tiny data classes. Revisit if a third
JVM consumer needs the same logic.
