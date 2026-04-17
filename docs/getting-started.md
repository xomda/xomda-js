# Getting Started

This guide walks through installing xomda, opening a project, designing a small model, and generating code from it.
It assumes no prior knowledge of xomda; for the underlying ideas see [Concepts](./concepts.md).

## Prerequisites

- **Node.js** 20 or newer
- **pnpm** 10 or newer (`npm install -g pnpm` if you do not have it)

## Install

```bash
git clone <repo-url> xomda
cd xomda
pnpm install
```

## Run

```bash
pnpm dev
```

This starts the backend (`@xomda/node`, port `6431`) and the web client (`@xomda/client`, port `5173`) in parallel.
Open [http://localhost:5173](http://localhost:5173).

## What a xomda project looks like

A xomda project is any directory that contains a `.xomda/` folder. xomda creates and reads everything from there:

```
your-project/
└── .xomda/
    ├── model.json       # the data model (safe to check into git)
    ├── project.json     # name, description, version history, settings, active plugins
    ├── templates/       # *.template.json files, optionally grouped in sub-folders
    └── history/         # version snapshots (v-<uuid>.json), referenced from project.json
```

`project.json` is created on demand — the home page works fine without it, and the
Settings page (or the _Refresh detection_ button) writes it the first time you save
something. By default xomda uses the `.xomda/` folder in the current working directory;
override with the `XOMDA_DIR` environment variable.

For the full schema of `model.json`, see [Data model](./data-model.md). For how templates work, see
[Templates](./templates.md).

## A first model

In the **Model** view:

1. Add a package — e.g. `domain`.
2. Inside it, add an entity called `User`.
3. Give `User` two attributes: `id` (type `UUID`, primary key) and `email` (type `string`, required, unique).

Save. The model is written to `.xomda/model.json` in a deterministic order so it produces clean git diffs.

## A first template

In the **Templates** view, create a new template `TypeScript/user-interface.template.json` with a **loop** cell
(`loopSource: entities`) and, nested inside it, two children:

1. A **handlebars** child cell:
   ```handlebars
   export interface
   {{pascalCase name}}
   {
   {{#each attributes}}{{camelCase name}}:
     {{type}}
   {{/each}}
   }
   ```
2. An **output** child cell with `outputFilename: {{pascalCase name}}.ts`.

The loop runs its children once per entity, and the output cell — sitting inside the loop — writes one file per
entity. (Drop the output cell _after_ the loop instead if you want a single bundled file containing every entity.)

In the **Generate** view, click _Generate_. xomda runs the template once per entity in the model and writes the
resulting files to disk. The file browser marks generated files with a "G" chip.

## Next steps

- Learn the full template language: [Templates](./templates.md).
- Understand the data model: [Data model](./data-model.md).
- Read about the philosophy: [Concepts](./concepts.md).
- Set up your dev environment for contributing: [Development](./development.md).
