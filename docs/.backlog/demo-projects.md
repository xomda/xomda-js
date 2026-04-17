# Real-project demos (Track G)

Concrete deliverable for the user's TODO "create real projects in the demos."
The existing `demo/springboot/` is a generator harness — it produces output, but
nothing inside it ever *consumes* the output to prove it compiles and runs. This
backlog item turns that around: every demo is a real, runnable project whose CI
job regenerates → compiles → runs hand-written tests against the generated code.

## Layout convention (pin this first)

```
demo/<name>/
├── README.md                   what this demo proves
├── .xomda/
│   ├── model.json              the model
│   └── templates/              the templates exercised
├── package.json                TS harness (generate script, vitest sanity check)
├── scripts/generate.mjs        drives @xomda/cli or @xomda/template directly
├── src/main/java/...           hand-written (Application.java, glue, config)
├── src/main/generated/         [gitignored] regenerated every build
├── src/test/java/...           hand-written integration tests
└── pom.xml | build.gradle      invokes the xomda Maven/Gradle plugin
```

Hard rule: **generated code lives under `generated/`, hand-written code under
`main/`, tests under `test/` — never overlapping**. CI regenerates, compiles,
tests, and asserts the test suite passes.

## Demo matrix

| Demo                  | Build    | Stack                              | Templates exercised                       | Tests                       |
| --------------------- | -------- | ---------------------------------- | ----------------------------------------- | --------------------------- |
| `demo/maven-plain`    | Maven    | Plain Java 21 + records            | POJO/record entity                        | JUnit 5                     |
| `demo/spring-boot`    | Maven    | Spring Boot 4 + JPA + Spring Data  | JPA entity, repository, REST controller   | `@SpringBootTest` + TC PG   |
| `demo/gradle-plain`   | Gradle   | Plain Java 21                      | Same model as maven-plain                 | JUnit 5                     |
| `demo/quarkus`        | Maven    | Quarkus + Panache                  | Panache entity, JAX-RS resource           | `@QuarkusTest`              |
| `demo/spring-elastic` | Maven    | Spring Boot + Spring Data Elastic  | Elastic entity, search repository         | `@SpringBootTest` + TC ES   |

## Execution order

1. **G1 — `demo/maven-plain`.** Smallest possible end-to-end. Pins the layout +
   regenerate-then-compile-then-test loop. Use a 2-entity model
   (User + Order) and a single record-style template. JUnit 5 verifies the
   constructors and a simple `equals`/`hashCode` derivation.
2. **G2 — `demo/spring-boot`.** Flagship. Adds Testcontainers (Postgres) and
   `@SpringBootTest`. Templates: JPA entity, Spring Data repository, REST
   controller, Lombok-annotated entity option, MapStruct DTO mapper.
3. **G3 — `demo/gradle-plain`.** Same model as G1, different build tool —
   proves the Gradle plugin works on a real consumer.
4. **G4 — `demo/quarkus`.** Panache entity + JAX-RS resource. Different ORM
   idiom from Spring's JPA; catches assumptions baked into the JPA templates.
5. **G5 — `demo/spring-elastic`.** Persistence-layer swap + the first generated
   *test* code (entity smoke tests authored as templates, not by hand).

## CI

Add a `pnpm test:demo` script that runs each demo's "regenerate → build →
test" cycle. Don't put it in `pnpm test` (the Testcontainers cost is too high).
Wire it into a separate workflow alongside `pnpm test:jvm`.

## Open questions for the user (carry forward)

1. Shared model vs. per-demo model? Recommendation: shared `demo/blog/` model
   for G1–G4, domain-specific catalog model for G5 (Elastic-friendly).
2. Generated tests live in `src/test/generated/` (gitignored) or are
   committed and edited? Affects how invasive a regeneration is.
3. CI gating — confirm Testcontainers Postgres/Elastic on a separate workflow.
