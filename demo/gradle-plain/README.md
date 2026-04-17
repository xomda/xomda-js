# `demo/gradle-plain` — plain Java + Gradle + JUnit 5

Same `User`+`Order` model and same `Java record` template as
[`demo/maven-plain`](../maven-plain/) — different build tool. Proves the
xomda regenerate → compile → test loop works for Gradle consumers too,
end-to-end:

1. `.xomda/model.json` defines two entities (`User`, `Order`).
2. `.xomda/templates/gradle-plain/record.template.json` generates a
   Java `record` per entity into `src/main/generated/`.
3. Hand-written [`src/main/java/com/example/App.java`](./src/main/java/com/example/App.java) *uses* the
   generated records.
4. Hand-written JUnit 5 tests in
   [`src/test/java/com/example/AppTest.java`](./src/test/java/com/example/AppTest.java)
   exercise the generated records and the hand-written wiring.
5. [`build.gradle`](./build.gradle) wires `src/main/generated/` into
   `sourceSets.main.java.srcDirs` so `gradle test` picks up both halves.

`src/main/generated/` is gitignored — every clone runs `pnpm generate`
before `gradle test`.

## Running

```bash
# From the demo folder.
pnpm generate    # writes .xomda/model.json and regenerates src/main/generated/
gradle test      # compiles hand-written + generated, runs JUnit 5

# Or from the repo root (and as part of pnpm test:demo).
pnpm -F @xomda/demo-gradle-plain generate
gradle -p demo/gradle-plain test
```

## Two test layers (per AGENTS.md rule 12)

- **Vitest inner loop** — `src/__tests__/generate.spec.ts` renders the
  template against synthesised models and asserts on `RenderResult.content`.
  Read-only; never mutates `.xomda/model.json` or `src/main/generated/`.
- **Gradle outer loop** — `gradle test` compiles the actually-generated
  Java + hand-written `App.java` and runs JUnit 5. Template drift
  surfaces as a compile or assertion failure.
