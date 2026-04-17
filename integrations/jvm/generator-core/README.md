# xomda-generator-core

Java implementation of the xomda code-generation engine — the JVM counterpart of the TypeScript
[`@xomda/template`](../../../packages/template) package.

Reads `.xomda/model.json` (Jackson), discovers `.template.json` files in `.xomda/templates/`,
processes the cell-based templates with Handlebars + Java cell processors, and writes the resulting
files to a configured output directory. All of xomda's JVM-side integrations (Maven plugin, Gradle
plugin, IntelliJ plugin, Eclipse plugin) build on top of this module.

## Coordinates

```xml
<dependency>
    <groupId>org.xomda</groupId>
    <artifactId>xomda-generator-core</artifactId>
    <version>0.0.1-SNAPSHOT</version>
</dependency>
```

## Use it

```java
import org.xomda.generator.XomdaGenerator;
import java.io.File;
import java.util.List;

List<File> generated = XomdaGenerator.builder()
    .modelFile(new File(root, ".xomda/model.json"))
    .templatesDir(new File(root, ".xomda/templates"))
    .outputDir(root)
    // .logger(slf4jLogger)            // optional
    .build()
    .generate();
```

The `Logger` SAM (`org.xomda.generator.Logger`) is the only optional hook. Default is a no-op so
the engine has no logging side effects unless asked.

## Build & test

From the repo root:

```bash
mvn -f integrations/jvm/generator-core verify
```

Or via the JVM aggregator (which also builds the Maven plugin):

```bash
mvn -f integrations/jvm verify
```

Tests use JUnit 5 + Jackson and share fixtures with the TS template engine via:

```
packages/template/src/__fixtures__/*.json
```

Those fixtures are read directly by [`TemplateEngineTest`](./src/test/java/org/xomda/generator/template/TemplateEngineTest.java)
to keep the two implementations honest. Path traversal in that test computes the worktree root from
the test-classes directory; if you ever relocate this module, update the parent count there.

## Publishing for downstream JVM consumers

The other JVM plugins (Maven, Gradle, IntelliJ, Eclipse) consume this module from the project-local
Maven repo at `integrations/jvm/.m2-repo/`. Populate it with:

```bash
pnpm test:jvm:install-core
# equivalent to:
mvn -f integrations/jvm/generator-core install \
    -Dmaven.repo.local=$PWD/integrations/jvm/.m2-repo \
    -DskipTests
```

Use `-Dmaven.repo.local`, **not** `-DaltDeploymentRepository` (the latter is for `mvn deploy`).
