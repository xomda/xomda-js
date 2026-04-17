# xΟΔ — xomda.js

> A Model-Driven Architecture platform for designing data models once and generating the code that follows from
> them — for any stack you can write a template for.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

xomda lets you describe your domain — entities, attributes, enums, relationships — in one place, and turn that
description into the boilerplate code your application would otherwise need you to write and maintain by hand:
schemas, DTOs, validation, persistence layers, API surfaces, UI forms. The model lives next to your code in git;
templates decide what gets generated; regenerating is safe and repeatable.

## The problem xomda solves

Most non-trivial applications express the same domain types in three or four places: a database schema, a server-side
model, a wire format, and a client-side form. Keeping those in sync is rote, error-prone work. When the stack
changes — Spring Boot today, NestJS for a new service tomorrow, a Next.js admin panel after that — the same domain
gets rewritten yet again.

xomda treats the model as the single source of truth and treats every stack-specific representation as a template
that consumes it. Change the model, regenerate, and every layer follows.

## What xomda gives you

- **A visual data model designer** with packages, entities, enums, attributes, inheritance, and references — usable
  directly or alongside hand edits to a checked-in `.xomda/model.json`.
- **A cell-based template engine** that mixes JavaScript pre-computation with Handlebars output, so generators stay
  readable instead of collapsing into nested string concatenations.
- **Stack-agnostic generation.** Spring Boot, NestJS, Next.js, plain TypeScript, Java, anything you can template —
  the engine has no opinions about your target.
- **Deterministic, diff-friendly file storage.** `model.json` lives in your repo and produces clean git diffs;
  reordering in the UI does not shuffle the file.
- **Dynamic, model-driven UI.** Forms in the xomda client are derived from the model, so adding a field to the
  meta-model adds it to the editor automatically.
- **Runtime introspection** of the model from generated code, when you want it.
- **A type-safe tRPC API** for programmatic access — the client uses it, you can too.

## How it works

```
   model.json      ─┐                            ┌─►   src/main/java/...
                    │                            │
   templates/   ───►│  cell-based template       ├─►   src/server/...
                    │  engine (logic +           │
   model in UI  ───►│  handlebars cells)         ├─►   schemas, DTOs, ...
                    │                            │
                    └────────────────────────────┘
```

You design the model in the xomda client (or by hand). You author one or more templates that turn parts of that model
into source files. You hit *Generate*. Files land where the templates say they land. Run it again whenever the model
changes.

## Quick start

Prerequisites: Node.js 20+, pnpm 10+.

```bash
git clone <repo-url> xomda
cd xomda
pnpm install
pnpm build
pnpm start
```

Open [http://localhost:6431](http://localhost:6431). The xomda server serves both the API and the compiled
client from a single port. You will see xomda's own meta-model — xomda is built on xomda, and the `.xomda/`
folder in this repo contains the model that drives the platform itself.

The full walkthrough — first project, first model, first template, first generation — is in
[Getting started](./docs/getting-started.md).

Developing xomda itself? See [Development](./docs/development.md) for the Vite dev-server workflow,
per-package scripts, and the rest of the contributor setup.

## Who it's for

- **Teams shipping the same domain to multiple stacks.** Stop maintaining four versions of `User`.
- **Library and SDK authors** who need to publish typed clients and matching server stubs from a single source.
- **Internal-platform teams** building generators for the rest of the company — xomda gives you the engine and the
  modelling layer; you supply the templates.
- **Anyone tired of writing the same entity, the same DTO, and the same migration four times.**

## Documentation

Full documentation lives in [`docs/`](./docs/README.md):

| Topic                   | Document                                        |
|-------------------------|-------------------------------------------------|
| Concepts and philosophy | [concepts.md](./docs/concepts.md)               |
| Hands-on walkthrough    | [getting-started.md](./docs/getting-started.md) |
| Data model reference    | [data-model.md](./docs/data-model.md)           |
| Template language       | [templates.md](./docs/templates.md)             |
| Versioned wrapper       | [wrapper.md](./docs/wrapper.md)                 |
| API reference (tRPC)    | [api.md](./docs/api.md)                         |
| Codebase architecture   | [architecture.md](./docs/architecture.md)       |
| Development setup       | [development.md](./docs/development.md)         |
| Contributing            | [docs/contributing.md](./docs/contributing.md)  |

## License

MIT — see [LICENSE](./LICENSE).
