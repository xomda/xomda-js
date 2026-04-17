# Project Analysis

This document describes the project-analysis subsystem: the framework that inspects an opened project to detect
which technologies, build tools, and editors are in use. It informs template suggestions, configuration defaults,
and tooling warnings.

For the broader package layout, see [Architecture](./architecture.md).

## How it works

When xomda opens a project, the analysis framework walks the project directory and runs a set of **detectors** against
its files. Each detector recognises a specific technology — TypeScript, Java (Maven, Gradle, Ant), Rust, Vite,
Webpack, ESLint, Prettier, Stylelint, VS Code, IntelliJ, Visual Studio, and xomda itself, among others.

A detector matches against:

- file or folder presence (e.g. `package.json`, `pom.xml`, `.idea/`),
- and optionally file content (e.g. a specific dependency in `package.json`).

The `.xomda` detector is special: any directory with a `.xomda/` folder is, by definition, a xomda project, so this
detector is always loaded.

## Plugin structure

Detectors are distributed as plugins:

- The framework lives in `@xomda/analysis-core` and defines the detector interface.
- Each detector is a separate package named `@xomda/plugin-analysis-<technology>` (e.g.
  `@xomda/plugin-analysis-eslint`).

Plugins should be efficient: file-system traversal runs on every project open, so detectors are expected to be cheap
and to bail out as soon as they have enough evidence. Where useful, plugins may be grouped by detection key so the
framework can run a group together.

## Outputs

Detection results feed back into xomda in several ways:

- **Template suggestions.** Surface templates that target detected stacks.
- **Configuration defaults.** Pre-fill options based on what is already in the project.
- **Tooling warnings.** Flag missing or incompatible tools.
- **File icons.** Detectors may contribute icons for files and folders they own.

## Future directions

Plugins are expected to grow beyond detection — for example, offering dependency updates or providing a custom view
for a specific file type.

## See also

- [Architecture](./architecture.md) — where the analysis packages sit in the dependency graph.
