# Demos

Real, runnable projects that exercise xomda end-to-end: a TypeScript
harness regenerates the model-driven half of each demo into
`src/main/generated{,-resources}/` (or `output/` for the Vue demo), and
the demo's **own build environment** (Maven, Quarkus, Vite) compiles and
tests the generated code alongside hand-written app skeleton.

Demo names follow the convention `<tech>-<domain>` so the focus is
obvious from the folder name.

## Available demos

| Folder                                         | Tech                                | What it proves                                                                                                                  |
| ---------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [`maven-plain/`](./maven-plain/)               | Plain Java 21 + Maven + JUnit 5     | Generated records compile & wire alongside hand-written `App.java`; pins the layout convention every JVM demo follows           |
| [`gradle-plain/`](./gradle-plain/)             | Plain Java 21 + Gradle + JUnit 5    | Same model + template as `maven-plain`, different build tool; proves the regenerate → compile → test loop works under Gradle    |
| [`springboot-blog/`](./springboot-blog/)       | Spring Boot 4 + JPA + Flyway        | Generated JPA entities, repositories, services, DTOs round-trip through `@SpringBootTest` against H2 (real Postgres via Docker) |
| [`quarkus-todos/`](./quarkus-todos/)           | Quarkus 3 + Panache + JAX-RS        | Generated Panache entities + JAX-RS CRUD resources answer real HTTP calls under `@QuarkusTest` (REST-assured)                   |
| [`vue-blog/`](./vue-blog/)                     | Vue 3 + Vite + Zod                  | Generated `AuthorSchema` (Zod) drives validation in a hand-written Vue form; `@vue/test-utils` mount asserts the integration    |
| [`node-types/`](./node-types/)                 | Node + Vitest + hand-written model  | Minimal `xomda generate` flow — `.xomda/model.json` hand-authored, no tsx glue. The smallest possible end-to-end loop.          |

## The contract for every demo

Per [AGENTS.md rule 12](../AGENTS.md#essential-rules) and
[`docs/.backlog/demo-projects.md`](../docs/.backlog/demo-projects.md):

1. **Hand-written under `main/`, generated under `generated/`,
   tests under `test/` — never overlapping.** Generated dirs are
   `.gitignore`d.
2. **Two test layers, both required:**
   - **Vitest** in-memory render assertions (`src/__tests__/*.spec.ts`) —
     fast inner loop; asserts the *shape* of the generated source.
   - **Build-env tests in the demo's own language** — Maven JUnit /
     `@SpringBootTest` / `@QuarkusTest` / Vitest+happy-dom. Compiles
     the generated code and exercises it through the real runtime.
3. **A regenerate → build → test loop that fails loudly** when a
   template drifts.

## Run a single demo

```bash
# Vitest fast loop
pnpm --filter @xomda/demo-<name> test

# Real-build-env tests (per demo)
pnpm --filter @xomda/demo-<name> generate
pnpm --filter @xomda/demo-<name> test:jvm     # JVM demos (mvn test or gradle test)
pnpm --filter @xomda/demo-vue-blog dev        # vite dev server (vue-blog)
```

## Run every demo

```bash
pnpm test:demo            # vitest then JVM mvn test across all demos
pnpm test:demo:vitest     # vitest only (~1s)
pnpm test:demo:jvm        # JVM only (~minutes)
```

`pnpm test:all` chains `pnpm test` → `pnpm test:jvm` → `pnpm test:demo`
in fail-fast order.
