# Brainstorm

This folder holds non-authoritative founder notes and design brainstorms.
Files here are intentionally informal — first-pass thinking, open
questions, dead ends, and resolved positions live side by side.

## What this folder is

- A record of where ideas came from and why decisions were taken.
- A place to capture half-formed thoughts before they harden into
  canonical docs.
- A reading list for engineers who want to understand the *why* behind
  Xomda's design choices, not just the *what*.

## What this folder is NOT

- **Not authoritative.** Anything here may be wrong, outdated, or
  contradicted by current code. Canonical schema lives in
  [data-model.md](../data-model.md); canonical concepts in
  [concepts.md](../concepts.md).
- **Not a roadmap.** Roadmap items live in [TODO.md](../TODO.md).
- **Not API documentation.** Procedures and routers are documented in
  [api.md](../api.md).

## Conventions

- Each file opens with a status banner naming its provenance and
  pointing readers at the current truth.
- Contradictions with current behaviour are annotated inline using
  `> **[Resolution YYYY-MM-DD]** ...` blockquotes. The original
  contradictory prose is **never deleted** — the resolution sits next
  to the original idea so the history of the thinking stays visible.
- Open questions stay in place until a resolution note retires them.

## Files

- [mda.md](./mda.md) — the founding design note on Model-Driven
  Architecture in Xomda.
