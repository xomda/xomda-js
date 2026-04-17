# CLAUDE.md — xomda-js

You're Claude (or another agent reading `CLAUDE.md` as project context) and
the current project depends on `xomda-js`. Before authoring or editing any
`.xomda/model.json` or `*.template.json` file:

1. Read [`AGENTS.md`](./AGENTS.md) in this package — one-screen cheat sheet
   with the hard rules for valid models and templates.
2. Read the matching deep reference for the file you're about to touch:
   - Editing `.xomda/model.json` → [`docs/.ai/model-format.md`](./docs/.ai/model-format.md)
   - Editing a `*.template.json` → [`docs/.ai/template-format.md`](./docs/.ai/template-format.md)
   - Calling the CLI → [`docs/.ai/cli-reference.md`](./docs/.ai/cli-reference.md)

The single source of truth for agent guidance is [`AGENTS.md`](./AGENTS.md);
this file exists so harnesses that scan for `CLAUDE.md` find their way to it.

## TL;DR (still: read `AGENTS.md`)

- npm package = `xomda-js`. CLI binary = `xomda`. Run with `npx xomda-js` or
  `xomda <subcommand>` after install.
- Model is **language-neutral**. Primitive types are `string`, `number`,
  `boolean`, `date`, `uuid`, `decimal` (lowercase). No `BigDecimal`, no
  `java.*`, no framework annotations in the model — that's the template's
  job.
- Every element has a fresh **UUIDv4** `id`. Array order is display order.
- Run `xomda preview` / `xomda diff` before `xomda generate`.
