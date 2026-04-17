# xomda-maven-plugin

Maven Mojo that runs xomda code generation as a build phase. Wraps
[`xomda-generator-core`](../generator-core).

## Apply it

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.xomda</groupId>
            <artifactId>xomda-maven-plugin</artifactId>
            <version>0.0.1-SNAPSHOT</version>
            <executions>
                <execution>
                    <goals>
                        <goal>generate</goal>
                    </goals>
                </execution>
            </executions>
            <!-- optional -->
            <configuration>
                <root>${project.basedir}</root>
                <outputDir>${project.build.directory}/generated-sources/xomda</outputDir>
            </configuration>
        </plugin>
    </plugins>
</build>
```

The `generate` goal binds to `generate-sources` by default, so `mvn compile` (or any phase after
it) will run codegen first.

## Build & test

This module is part of the JVM Maven aggregator at [`integrations/jvm/pom.xml`](../pom.xml):

```bash
mvn -f integrations/jvm verify         # generator-core + this plugin
mvn -f integrations/jvm/maven verify   # just this plugin (reactor still resolves generator-core)
```

Within the reactor build, `generator-core` is resolved intra-reactor; no `~/.m2` install needed.
Standalone builds (`-f integrations/jvm/maven`) only work after either
`pnpm test:jvm:install-core` or a regular `mvn install` of generator-core has happened.

## End-to-end demo

[`demo/springboot`](../../../demo/springboot) is a Spring Boot project that consumes this plugin.
Its [`pom.xml`](../../../demo/springboot/pom.xml) wires the plugin in and uses the generated Java
sources alongside hand-written code.
