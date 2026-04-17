# Real-project demos (Track G)

Concrete deliverable for the user's TODO "create real projects in the demos."
The original `demo/springboot/` was a generator harness — it produced
output, but nothing inside it ever *consumed* the output to prove it
compiles and runs. This track turns that around: every demo is a real,
runnable project whose CI job regenerates → compiles → runs hand-written
tests against the generated code.

## Layout convention (pin this first)

```
demo/<tech>-<domain>/
├── README.md                   what this demo proves
├── .xomda/
│   ├── model.json              the model
│   └── templates/              the templates exercised
├── package.json                TS harness (generate script, vitest sanity check)
├── scripts/generate.mjs        drives @xomda/cli or @xomda/template directly
├── src/main/java/...           hand-written (Application.java, glue, config)
├── src/main/generated/         [gitignored] regenerated every build
├── src/main/generated-resources/  [gitignored] for non-Java generated files (SQL, etc.)
├── src/test/java/...           hand-written integration tests
└── pom.xml | build.gradle      invokes the xomda Maven/Gradle plugin
```

Hard rule: **generated code lives under `generated/`, hand-written code
under `main/`, tests under `test/` — never overlapping**. CI regenerates,
compiles, tests, and asserts the test suite passes. **`pnpm test:demo`
runs the full cycle for every demo; `pnpm test:all` chains it after
`pnpm test:jvm`.**

## Demo matrix

| Demo                       | Build  | Stack                              | Templates exercised                       | Tests                            | Status     |
| -------------------------- | ------ | ---------------------------------- | ----------------------------------------- | -------------------------------- | ---------- |
| `demo/maven-plain`         | Maven  | Plain Java 21 + records            | POJO/record entity                        | JUnit 5                          | ✅ shipped |
| `demo/gradle-plain`        | Gradle | Plain Java 21 + records            | Same model + template as maven-plain      | JUnit 5                          | ✅ shipped |
| `demo/springboot-blog`     | Maven  | Spring Boot 4 + JPA + Spring Data  | JPA entity, repository, service, DTO, enum, Flyway V1 | `@SpringBootTest` + H2 (Testcontainers Postgres deferred) | ✅ shipped |
| `demo/quarkus-todos`       | Maven  | Quarkus 3 + Panache + JAX-RS       | Panache entity, JAX-RS resource, enum, Flyway V1 | `@QuarkusTest` + REST-assured + H2 | ✅ shipped |
| `demo/vue-blog`            | Vite   | Vue 3 + Zod                        | Zod schema, TS interface, Java POJO, core schema | Vitest (node + happy-dom)         | ✅ shipped |
| `demo/spring-elastic`      | Maven  | Spring Boot + Spring Data Elastic  | Elastic entity, search repository         | `@SpringBootTest` + TC ES         | Open       |

## Done

1. **G1 — `demo/maven-plain`.** Smallest possible end-to-end. Pinned the
   layout + regenerate-then-compile-then-test loop. 2-entity model
   (User + Order), single record-style template.
2. **G2 — `demo/springboot-blog`** (formerly `demo/springboot`). Real
   Spring Boot 4 project with hand-written pom.xml / application.yml /
   BlogServiceApplication; generated JPA entities, repositories, services,
   DTOs, enums, Flyway V1. Tests use H2 in PostgreSQL mode (no Docker
   needed in CI); Testcontainers Postgres can layer on later.
3. **G4 — `demo/quarkus-todos`.** Real Quarkus 3.17 project — Panache
   active-record entities, JAX-RS CRUD resources, Flyway V1. Tests use
   `@QuarkusTest` + REST-assured against H2.
4. **`demo/vue-blog`** (formerly `demo/blog`). Vue 3 + Vite SPA that
   validates input via the generated `AuthorSchema`. Two vitest projects
   (node + dom) under one config.
5. **G3 — `demo/gradle-plain`.** Same User+Order model and same Java
   record template as `maven-plain`, different build tool. `build.gradle`
   adds `src/main/generated` to `sourceSets.main.java.srcDirs`; JUnit 5
   under `useJUnitPlatform()`.
6. **AGENTS.md rule** — demos that generate code MUST test the generated
   code in the demo's own build env and language; rule applies to any
   AI-agent-produced demo.

## Still open

5. **G5 — `demo/spring-elastic`.** Persistence-layer swap + the first
   generated *test* code (entity smoke tests authored as templates, not
   by hand).

## CI

`pnpm test:demo` runs every demo's "regenerate → build → test" cycle.
Chained into `pnpm test:all` after `pnpm test:jvm` (fail-fast — cheap
vitest first, then JVM, then demos). Not in `pnpm test` (the Maven cost
is too high for the inner dev loop). Wire into a separate workflow
alongside `pnpm test:jvm` when adding CI.

## Open questions for the user (carry forward)

1. ~~Shared model vs. per-demo model?~~ Decided: per-demo model. Each
   demo carries its own `.xomda/model.json` so the model can be tailored
   to the technology (blog for vue/spring, todos for quarkus, user+order
   for maven-plain). Shared models are easy to introduce later if a real
   consumer needs them.
2. Generated tests live in `src/test/generated/` (gitignored) or are
   committed and edited? Affects how invasive a regeneration is.
3. CI gating — confirm Testcontainers Postgres/Elastic on a separate
   workflow when G5 lands.
