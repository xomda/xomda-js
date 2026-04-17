# Docs for AI coding assistants

These files are written for AI coding assistants (Claude, Cursor, Copilot,
Windsurf, Cline/Roo, Junie, …) that need to author or modify xomda artifacts
on behalf of a user. Every file in this folder is **bundled into the
published `xomda` npm tarball under `docs/.ai/`** — so an agent working in a
project that depends on `xomda` can read them without cloning the repo.

The folder name starts with `.` to keep it out of the way in casual file
listings: humans rarely need to open it, agents always do.

## What's here

| File | Purpose |
| --- | --- |
| [AGENT_GUIDE.md](./AGENT_GUIDE.md) | Read this first. Orientation: what xomda is, the two-tier mental model, where its files live, how a generation cycle works. |
| [model-format.md](./model-format.md) | The `.xomda/model.json` schema. Enough to write a valid model from scratch, or extend one. |
| [template-format.md](./template-format.md) | The `*.template.json` cell-based format. Every cell type, the Handlebars helper library, a worked example. |
| [cli-reference.md](./cli-reference.md) | Every `xomda` subcommand, what it reads, what it writes, what it prints. |

## Keep these updated

This is also a **rule for AI agents working _in this repo_**: when you change
anything that an end user would author against — the data-model schema in
`@xomda/core`, the template engine in `@xomda/template`, the CLI surface,
or the on-disk file conventions — update the matching file under
`docs/.ai/` in the same commit. The rule lives in
[`AGENTS.md`](../../AGENTS.md) under "Documentation for AI agents".

Drift here doesn't show up in tests; it shows up months later as agents
generating subtly invalid models against an outdated description. Treat
these files as part of the public API surface.
