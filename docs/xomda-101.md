## xomda

# MDA

- model driven architecture is the core of xomda.
- a project with a .xomda folder in it that contains the expected files in it, is a xomda project and can be opened with
  the xomda client. the core usage for xomda at this stage is to provide a way to define a model, both as a file that
  can be checked in in the repo and modified manually, there will also be a xomda client to present a visual interface
  to the user.
- the xomda source code repo itself, will also use a .xomda folder and define a model. that model is the core xomda
  model, from which end-users of xomda will then extend their models from. this model describes which elements are part
  of the model (it's describing). it's a loop. it will also define which elements to read and write from and to the json
  file, or which fields to show on a (dynamic) form that edits this entity, or enum, or whatever (that's defined in the
  model).
- it's okay that xomda its own model needs to be regenerated for the changes to become apparent. They will affect the
  source code, such as they will on any project xomda is used.
- so, what the application show, are packages and entities and enums and such. they have a visual representation which
  is predetermined
- the json file that contains the model, should be predictable, in the sense that objects and attributes should not
  switch position suddenly.
- this is for xomda using xomda, not for end-user-projects that use xomda: ideally, their is a serializer and
  deserializer, that uses the generated .xomda model, to serialize and deserialize the json.
- this is for xomda using xomda, not for end-user-projects that use xomda: ideally, the generated .xomda code is used to
  know how to display a form for an entity.

# two-tier architecture

- **tier 1 — meta-model (xomda itself)**: xomda's own `.xomda/model.json` defines the schema of *all* xomda models.
  it describes what an Entity, Attribute, Package, and Enum are — including which fields each has and how they behave.
  this meta-model is the foundation everything else is built on.
- **tier 2 — user models**: end-users open their own project in xomda, extend xomda's built-in meta-types, and author
  stack-specific templates. their `.xomda/model.json` defines domain-specific types (e.g. `User`, `Order`) that build
  on xomda's primitive concepts.
- the self-bootstrapping consequence: changing xomda's own meta-model requires regenerating xomda's own source code.
  this is intentional — xomda eats its own cooking.
- tier-2 users should not see tier-1 implementation details. they work purely with their domain model and templates.

# data model

the data model is the set of types stored in `.xomda/model.json`. all types are open by design — tier-2 users can
extend them with extra fields that round-trip losslessly.

## model

the root container. every xomda project has exactly one model.

- `id` — UUID
- `name` — display name (default: `Untitled Model`)
- `version` — semver string (default: `1.0.0`)
- `packages` — ordered list of top-level packages
- `elementsOrder` — explicit UUIDs ordering the top-level elements (drives stable serialization)
- `createdAt`, `updatedAt` — ISO datetime strings

## package

a hierarchical namespace. packages can nest infinitely.

- `id` — UUID
- `name` — display name, unique among siblings
- `packages` — nested child packages
- `entities` — entities defined in this package
- `enums` — enums defined in this package
- `elementsOrder` — explicit UUIDs ordering entities, enums, and sub-packages within this package
- `description` — optional free text

## entity

a named data type with a list of typed attributes. equivalent to a class or record in most languages.

- `id` — UUID
- `name` — display name, unique within its package
- `attributes` — ordered list of attributes (names must be unique within the entity)
- `description` — optional free text
- `extends` — UUID of a parent entity whose attributes are inherited
- `abstract` — when true, the entity is a blueprint and should not be instantiated directly

## attribute

a single field on an entity.

- `id` — UUID
- `name` — field name, unique within the entity
- `type` — type name (see *attribute type system* below)
- `required` — whether the field is mandatory (default: `false`)
- `multiValue` — whether the field holds a list of values (default: `false`)
- `primaryKey` — marks this attribute as the primary identifier (default: `false`)
- `unique` — value must be unique (default: `false`)
- `uniqueScope` — when `unique` is true: `'global'` (across all instances) or `'parent'` (unique among siblings within
  the parent container, enforced as a collection-level constraint)
- `reference` — when `true` and the type names another entity, stores a **reference by id** (UUID string) rather than
  an embedded copy (default: `false`, i.e. embed)
- `defaultValue` — optional default value as a string
- `description` — optional free text

## attribute type system

the `type` field of an attribute is a plain string. the following values are recognised:

- **primitives**: `string`, `number`, `boolean`, `Date`, `UUID`, `decimal`
- **entity reference**: the name of another entity in the model. if `reference: true`, the attribute stores a UUID; if
  `reference: false` (default), the entity is embedded inline.
- **enum reference**: the name of an enum in the model. the attribute stores one of the enum's values.

type names are resolved by name at code-generation time, not by UUID. this keeps templates readable.

## enum

an enumeration type.

- `id` — UUID
- `name` — display name, unique within its package
- `values` — list of enum values, each with an `id` (UUID) and a `name`
- `description` — optional free text

# the .xomda project folder

every xomda project has a `.xomda/` folder at its root:

```
.xomda/
  model.json          # the serialised model (packages, entities, enums, attributes)
  templates/          # template++ cell-based templates (one sub-folder per template)
  handlebars/         # legacy handlebars templates (deprecated, being phased out)
```

- `model.json` is human-readable and safe to check into version control.
- the ordering of objects in `model.json` is driven by `elementsOrder` arrays, so the file is stable across edits and
  produces clean git diffs.

# model json format

- the json file is deterministic: `elementsOrder` on `Model` and `Package` holds an explicit array of UUIDs that
  controls the serialization order of all child elements.
- entities, enums, and packages are stored as arrays in definition order; their position in the file matches
  `elementsOrder`.
- this predictability is intentional — manual edits and merge conflicts stay manageable.

# code generation workflow

1. **author a template** — define a template++ template (or legacy handlebars template) with a scope
   (`Entity`, `Package`, or `Enum`).
2. **generate** — the generate view runs all templates against the current model. for scoped templates, the engine
   iterates over every entity (or package, or enum) and renders once per item. output is held in memory.
3. **diff** — the generate view shows a diff of what the generated output would change compared to what is currently on
   disk.
4. **promote** — the user accepts the changes; the output files are written to disk.

this workflow ensures code generation is always a conscious, reviewable step — nothing is written without the user
seeing the diff first.

# templates

## template++ (cell-based) — current system

templates are composed of **cells** stacked vertically. cells execute top-to-bottom; each cell receives and can enrich
the shared context, then passes it to the next cell.

**cell types:**

- **logic cell** — javascript code that transforms the context object. the return value becomes the new context passed
  to the next cell. useful for filtering, mapping, or enriching data before rendering.
- **handlebars cell** — a handlebars template string rendered with the current context. the rendered string is appended
  to the output buffer.
- **buffer cell** — explicitly manipulates the output buffer (e.g. reset, split, or label sections).
- **markdown cell** — documentation-only; does not affect the context or output buffer. used to annotate the template.
- **output cell** — writes the accumulated output buffer to a file. configures the output filename and directory. every
  template ends with one or more output cells.

**template metadata:**

- `uuid` — UUID
- `name` — display name
- `description` — optional free text
- `version` — semver string
- `scope` — `Entity`, `Enum`, or `Package` (determines the iteration unit during generation)
- `extends` — UUID of a parent template (template inheritance)
- `cells` — ordered list of cells

**cell metadata:**

- `uuid` — UUID
- `type` — one of `logic`, `handlebars`, `buffer`, `markdown`, `output`
- `content` — the cell's source (javascript code, handlebars string, or markdown text)
- `variableName` — optional: bind the cell's output to a named variable in context
- `outputFilename`, `outputDirectory`, `outputContent` — output cell fields (rendered as a form, not a code editor)

**cell preview:**
each cell has a collapsible preview panel. for logic cells it shows the resulting context as json; for handlebars cells
it shows the rendered string; for output cells it shows the resolved file path.

## legacy handlebars templates

flat `.hbs` files stored in `.xomda/handlebars/`. still supported for backwards compatibility but deprecated — new
templates should use template++. the generate view and file browser work with both systems.

# model designer

- the model designer should allow a user to create the model using an UML-like designer
- the model designer shows packages, entities and enums.
- the elements on the model designer page, should be drag & droppable, so they can be dragged around and placed anywhere
  on the canvas. the surrounding package should adapt its size if a model within gets dragged outside of its boundary.
- the locations (and maybe sizes for packages) should not be part of the model itself. package, entity or enum has a
  unique identifier. it would rather be preferred to keep a separate map (inside the model json file maybe?) that
  contains the UUID as key and the coordinates (and size?) as value.
- packages should be resizable, the rest doesnt.
- the background of the model designer contains dots. the dragging and dropping should also be done in chunks of 10,
  16 or 20px or so. so that the elements on the page align to these.

# model designer

- the model designer should allow a user to create the model using an UML-like designer
- the model designer shows packages, entities and enums.
- the elements om the model designer page, should be drag & droppable, so they can be dragged around and placed anywhere
  on the canvas. the surrounding package should adapt its size if a model within gets dragged outside of its boundary.
- the locations (and maybe sizes for packages) should not be part of the model itself. package, entity or enum has a
  unique identifier. it would rather be preferred to keep a separate map (inside the model json file maybe?) that
  contains the UUID as key and the coordinates (and size?) as value.
- packages should be resizable, the rest doesnt.
- the background of the model designer contains dots. the dragging and dropping should also use be done in chunks of 10,
  16 or 20px or so. so that the elements on the page align to these.

# user interface

## design principles

- the xomda client is a ui for the xomda node backend
- the ui should be modern and professional
- the ui consists of reusable components, from vuetify or derived components in the @xomda/ui package
- each page should use the same base-components and principles, to ensure a consistent layout
- material symbols are used as icons — thin stroke variant, not heavy

## views

### model view

the primary editing surface. shows the model as a visual canvas:

- packages, entities, and enums are rendered as cards or nodes on the canvas
- users can add, rename, and delete packages, entities, enums, and attributes
- attribute editing uses **self-describing dynamic forms**: the form fields shown for an attribute are driven by the
  xomda meta-model's own `Attribute` entity definition. this means the form is generated from the model, not
  hard-coded in the ui — a direct demonstration of the mda principle.
- drag-and-drop or toolbar actions for moving and reordering elements

### templates view

manages template++ templates:

- lists all templates stored in `.xomda/templates/`
- create, rename, delete templates
- open a template to edit its cells in an inline cell editor (monaco editor for code cells, form for output cells)
- cell reordering (add, remove, move up/down)

### generate view

the code generation workflow:

- a "generate" button runs all templates against the current model
- output is shown as a diff (generated vs. current on disk)
- a "promote" action writes accepted changes to disk
- works with both template++ and legacy handlebars templates

### file browser

a read-only view of all files in the project's output directory. lets users browse and inspect generated files without
leaving the xomda client.

### home view

landing page shown on first open. displays project info and quick-access links to the main views.

# analysis framework

on opening a project, xomda runs an analysis pass over the target directory to detect which technologies are in use.
detectors are provided as plugins (`@xomda/plugin-analysis-*`) and cover: typescript, javascript, java (maven, gradle,
ant), rust, vite, webpack, eslint, prettier, stylelint, vscode, intellij, visual studio, and xomda itself.

detection results are used to:
- suggest relevant templates for the detected stack
- pre-fill configuration defaults
- warn about incompatible or missing tooling

the framework is extensible: new detectors implement the `@xomda/analysis-core` interface and register as plugins.

# getting started / cli

- a xomda project is any directory that contains a `.xomda/` folder with a valid `model.json`.
- the **`@xomda/cli`** package provides the command-line entry point for initialising new projects and running xomda
  from a terminal.
- the **`@xomda/node`** backend serves the tRPC api on port `3000`.
- the **`@xomda/client`** frontend spa runs on port `5173`.
- during development, `pnpm dev` starts both in parallel.
- to open an existing project, point the backend at the project's root directory; the client connects automatically.
