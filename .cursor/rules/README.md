# Cursor Rules

This folder contains the rules consumed by Cursor's AI features. The canonical, tool-neutral instructions for _all_
AI assistants (Cursor included) live in [`AGENTS.md`](../../AGENTS.md) at the repository root — read that first.

The MDC files here add Cursor-specific context that benefits from being colocated with `.cursor/`:

- [`project-overview.mdc`](./project-overview.mdc) — package layout and structure.
- [`tech-stack.mdc`](./tech-stack.mdc) — technologies and versions.
- [`coding-standards.mdc`](./coding-standards.mdc) — full formatting and convention reference.

For development workflow, scripts, environment, and deployment, see
[`docs/development.md`](../../docs/development.md).
