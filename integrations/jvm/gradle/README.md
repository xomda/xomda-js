# xomda-gradle-plugin

Gradle plugin that runs xomda code generation as part of a build. Wraps
[`xomda-generator-core`](../generator-core) in a Gradle task.

## Apply it

```gradle
plugins {
  id 'org.xomda.generate' version '0.0.1-SNAPSHOT'
}

xomda {
  // optional: defaults to project root
  root = projectDir
  // optional: defaults to project root
  outputDir = file('src/main/generated')
}
```

`build.gradle.kts`:

```kotlin
plugins {
    id("org.xomda.generate") version "0.0.1-SNAPSHOT"
}
```

A `xomdaGenerate` task is registered. By default it depends on nothing; wire it into your build
graph as you see fit:

```gradle
compileJava.dependsOn xomdaGenerate
```

## Build & test

The plugin consumes `xomda-generator-core` from the project-local Maven repo at
`integrations/jvm/.m2-repo/`. Run `pnpm test:jvm:install-core` once before building, or use the
chained `pnpm test:jvm` which does it for you.

```bash
gradle -p integrations/jvm/gradle test          # 3 Spock tests via gradleTestKit
gradle -p integrations/jvm/gradle build         # full build incl. publishing artifacts
```

## Notes

- `layout.buildDirectory = layout.projectDirectory.dir('build')` is set explicitly. The default is
  also `build/`, but pinning defends against IDEs picking adjacent folders (especially anything
  named `lib/`) as a default compile-output sink. See the AGENTS.md rule under "IDE & build
  integrations" for the reason.
- Earlier versions had a `settings.gradle` `includeBuild('../xomda-generator-core')` that pointed
  at a Maven project — Gradle reported "No variants exist" when the substitution kicked in, so it
  was effectively broken. It's been removed; dependency resolution goes through `.m2-repo`.
- Publishing config (OSSRH, GPG signing) is gated on `gradle.taskGraph.hasTask('publish')` and
  non-SNAPSHOT versions; local development never triggers it.
