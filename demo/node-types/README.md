# `demo/node-types` — minimal `package.json`-driven xomda flow

The smallest possible xomda demo. No `tsx` glue, no Vite, no JVM.

- **Model:** hand-written `.xomda/model.json` (single `User` entity).
- **Templates:** one hand-rolled template under `.xomda/templates/TypeScript/` that emits a `type` alias per entity.
- **Generation:** `npx xomda generate` — wired into `package.json` as the `generate` script.
- **Assertion:** vitest dynamically imports the emitted `.ts` file and checks the shape via `expectTypeOf`.

## Layout

```
demo/node-types/
├── .gitignore                                   ← excludes src/generated/
├── .xomda/
│   ├── model.json                               ← hand-written model
│   └── templates/TypeScript/type.template.json  ← entity → TS type alias
├── package.json                                 ← "generate": "xomda generate"
├── README.md
└── src/
    ├── generated/                               ← [gitignored] xomda output
    │   └── User.ts
    └── __tests__/
        └── types.spec.ts                        ← shape assertions
```

## Run

```bash
pnpm --filter @xomda/demo-node-types generate
pnpm --filter @xomda/demo-node-types test
```

## Why this demo exists

The other demos build their model in TypeScript via the `createEntity`/`createAttribute` helpers from `xomda` and persist `model.json` from a `scripts/build-model.ts`. This demo flips both: the model is authored as JSON and the only command anyone runs is `xomda generate`. It pins the contract that the published `xomda` CLI is enough to drive end-to-end generation on its own.

If this demo passes but a `tsx`-driven one fails, the regression is in the authoring helpers (`xomda`'s public API surface); if `xomda generate` itself breaks, this demo catches it first.
