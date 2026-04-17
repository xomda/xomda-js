# `demo/maven-plain` — plain Java + Maven + JUnit 5

The smallest possible end-to-end xomda demo:

1. `.xomda/model.json` defines two entities (`User`, `Order`).
2. `.xomda/templates/maven-plain/record.template.json` generates a Java
   `record` per entity into `src/main/generated/`.
3. Hand-written `src/main/java/com/example/App.java` *uses* the generated
   records.
4. Hand-written JUnit 5 tests in `src/test/java/com/example/` cover the
   generated records and the hand-written wiring.
5. `pom.xml` adds `src/main/generated/` as a source root via
   `build-helper-maven-plugin` so `mvn test` picks up both halves.

The point of this demo is to pin the **layout convention**
(`main/` hand-written, `generated/` regenerated, `test/` hand-written)
that every other JVM demo follows. See [`docs/.backlog/demo-projects.md`](../../docs/.backlog/demo-projects.md).

## Running

From this folder:

```bash
pnpm generate    # writes .xomda/model.json and regenerates src/main/generated/
mvn test         # compiles hand-written + generated, runs JUnit 5
```

Or in one step from the repo root:

```bash
pnpm -F @xomda/demo-maven-plain generate
mvn -f demo/maven-plain test
```

`src/main/generated/` is gitignored — every clone runs `pnpm generate`
before `mvn test`.
