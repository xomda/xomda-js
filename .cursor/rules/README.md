# AI Agent Instructions for Modelman (xomda.js)

This project uses `.cursor/rules` to provide context-aware instructions for AI agents.

## How to use these rules

- **Project Overview**: Refer to `project-overview.mdc` for the general structure and purpose of the monorepo.
- **Tech Stack**: Refer to `tech-stack.mdc` for details on the technologies and tools used.
- **Coding Standards**: Refer to `coding-standards.mdc` for formatting, linting, and best practices.

## Guidelines for AI Agents

1. **Context Awareness**: Always consider the monorepo structure. A change in `packages/model` might affect `packages/diagram` or `packages/client`.
2. **Command Execution**: Use `pnpm` for all package management and script execution tasks.
3. **Consistency**: Follow the existing coding style and patterns found in each package.
4. **Documentation**: When adding new features or components, ensure they are documented (e.g., KDoc, README updates, or Storybook stories).
