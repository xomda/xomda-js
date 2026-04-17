# `demo/springboot-blog/frontend` — Vue 3 SPA consuming the same model

A tiny Vue 3 + Vite frontend for the springboot-blog demo. Proves the strongest xomda story: one `.xomda/model.json` drives **both** the Spring Boot backend (Java DTOs, JPA entities, Flyway SQL, ES projections) **and** this frontend's TypeScript DTOs.

## What's generated

`xomda generate` in the parent (`demo/springboot-blog/`) emits the TypeScript types this app consumes into [`src/generated/`](./src/generated):

- `Author.ts`, `Post.ts`, `Comment.ts` — `type` aliases mirroring the Java DTO records on the server side.
- `PostStatus.ts` — literal union mirroring the Java enum.

`src/generated/` is `.gitignore`d — always reproducible from the model.

## Run

```bash
# 1. Backend
pnpm --filter @xomda/demo-springboot-blog generate
mvn -f demo/springboot-blog/spring-boot:run            # listens on :8080

# 2. Frontend (separate terminal)
pnpm --filter @xomda/demo-springboot-blog-frontend dev # listens on :5175
```

Vite proxies `/api/**` to the backend on :8080, so the SPA's `fetch('/api/authors')` hits the real `BlogController`.

## Tests

```bash
pnpm --filter @xomda/demo-springboot-blog-frontend test
```

Mounts `<AuthorList>` in happy-dom and verifies it renders one row per author returned by an injected fetch source. No live backend needed — the contract between halves is the shared (generated) `Author` type; the test asserts the component honors it.

## Why this matters

If the model changes — say, `Author` gains a `joinedAt: date` attribute — the next `xomda generate` updates the Java DTO, the SQL schema, AND the TypeScript type in lockstep. Anything depending on the old shape breaks at compile time on both sides, not at runtime in production.
