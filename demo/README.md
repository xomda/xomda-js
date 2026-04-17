# Demos

Runnable examples showing how to use xomda.js APIs programmatically.

Each demo lives in its own subfolder and is a standalone pnpm workspace package.

## Available demos

| Folder                         | What it shows                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| [`blog/`](./blog/)             | Build a Blog domain model in code, persist it, and generate Zod schemas + Java POJOs from it       |
| [`springboot/`](./springboot/) | Generate a Spring Boot 4 app — JPA entities, DTOs, repositories, services, and Flyway/Postgres SQL |

Each demo includes Vitest tests that exercise the generated code (importing it
for the TypeScript demo, asserting on its structure for the Java demo).

## Running a demo

```bash
# Install workspace dependencies from the repo root (once)
pnpm install

# Run a specific demo
pnpm --filter @xomda/demo-blog start
pnpm --filter @xomda/demo-springboot start

# Run a demo's tests
pnpm --filter @xomda/demo-blog test
pnpm --filter @xomda/demo-springboot test
```
