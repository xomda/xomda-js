# Concepts

This document explains the ideas behind xomda: what Model-Driven Architecture means here, why xomda is built around
self-definition, the two tiers it operates in, and the modelling primitives it gives you. For schema details see
[Data model](./data-model.md); for the template language see [Templates](./templates.md).

## Model-Driven Architecture

In a Model-Driven Architecture, the **model** — a precise description of your domain types — is the single source of
truth. Database schemas, API definitions, validation rules, and UI forms are all derived from it rather than
hand-written and kept in sync by hand.

xomda is an MDA platform built on this premise. You design a model once, author templates that turn that model into
code for whichever stacks you target, and regenerate any time the model changes.

## The two-tier architecture

xomda operates at two levels:

- **Tier 1 — meta-model.** xomda's own `.xomda/model.json` defines what _any_ xomda model can contain: what an Entity
  is, what an Attribute is, what fields a Package has, and so on. This is the meta-model that ships with xomda.
- **Tier 2 — your model.** When you open your project in xomda, you build a domain model on top of the tier-1
  primitives — types like `User`, `Order`, `Invoice` — and write templates that emit code for your stack.

A tier-2 user does not need to think about tier 1. The meta-model is just the foundation; you work with your domain
model and your templates.

## Self-definition

Because the meta-model is itself stored in `.xomda/model.json`, xomda can be used to edit _itself_. Open the xomda
repository in xomda and you see entries for `Entity`, `Attribute`, `Package`, `Enum`, and `Template` as ordinary
entities. Modifying the meta-model and regenerating produces new TypeScript and schema code in `packages/core/`,
which xomda then uses on its next start. The platform evolves through its own modelling system.

This is intentional. It keeps the meta-model honest (xomda is its own first user) and it means that any improvement
to the modelling primitives is immediately available to tier-2 users.

## Modelling primitives

xomda's data model is small on purpose. The full schema lives in [Data model](./data-model.md); the primitives are:

- **Model** — a root container; a project hosts one primary model plus any number of secondary models (each in its
  own `.xomda/models/<id>.json` file).
- **Package** — a hierarchical namespace; packages can nest.
- **Entity** — a named data type with a list of typed attributes.
- **Attribute** — a single field on an entity, with a type, cardinality, and constraints.
- **Enum** — an enumeration with a fixed set of named values.

All types are open by design: tier-2 users can extend them with extra fields that round-trip losslessly through
serialization.

## Models in a project

A project has one **primary model** at `.xomda/model.json` plus zero or more **secondary models** at
`.xomda/models/<id>.json`. Both kinds use the same `Model` schema; the primary is the canonical default that the
selector falls back to when no model id is supplied.

```
.xomda/
├── model.json              # primary
├── models/
│   ├── 71b2e4-….json       # secondary
│   └── 9c3a51-….json       # secondary
├── project.json
└── templates/
```

Router calls carry a `Selector { root?, modelId? }`:

- omit `modelId` → operate on the primary;
- pass `modelId` → operate on the named model, whether it is the primary or a secondary.

Multi-model is useful when a project carries several independent or related schemas (e.g. one model per bounded
context). Cross-model references between entities and enums are planned and tracked under the project-graph work;
see [data-model.md](./data-model.md) for the canonical schema.

## Inheritance, references, and blueprints

A few patterns recur often enough that xomda treats them as first-class:

- **Inheritance.** An entity can declare `extends` pointing at another entity; the parent's attributes are inherited.
- **Abstract entities (blueprints).** Marking an entity `abstract` means it should not be instantiated directly; it
  exists to be extended.
- **Aggregation kind.** When an attribute's type names another entity, the `aggregation` field declares the UML
  relationship: `'composite'` (the parent owns the related instances, embedded inline) or `'none'` (a plain
  association, stored as a UUID reference). Combined with `multiValue` this captures one-to-many, many-to-many,
  one-to-one, and many-to-one without inventing new vocabulary.

## Dynamic UI

The xomda client does not hard-code its forms. The form shown for editing an `Attribute`, for instance, is derived
from the meta-model's own definition of `Attribute`. Add a `validationPattern` field to that definition, regenerate,
and the form picks up an input for it the next time you open the editor. This is the cleanest demonstration of the
MDA principle inside the platform itself.

## Code generation

Generation is driven by templates stored in `.xomda/templates/`. Templates are not monolithic strings — they are
trees of small **cells** (logic, handlebars, loop, output, and a few others) that share a context as they execute.
Loop cells nest other cells beneath themselves and iterate over them — e.g. one cell tree generates per-entity files,
or, by placing the output cell _after_ the loop instead of inside it, one big file bundling all entities. This lets
you do imperative pre-computation in JavaScript and then a thin presentation layer in Handlebars, without inventing a
second DSL on top of it.

For the full template language, cell types, and the helper library, see [Templates](./templates.md).

## Generation discipline

A guiding principle from the founder's brainstorm, promoted here as a
durable rule: **whatever is model-dependent and can be generated, should be
generated.** When a downstream artefact derives mechanically from the model
— a schema, a DTO, a form, a migration, a typed client — write the template
that generates it rather than hand-maintaining a divergent copy. Hand-written
code earns its place only when the logic genuinely does not derive from the
model.

In practice this means:

- New stack support starts as templates, not bespoke code.
- When a piece of generated output drifts from what the model implies, fix
  the template — not the output.
- Tier-2 extensions (open fields on Attribute, custom Blueprints, new
  interfaces) feed into the same templates and produce the same kind of
  output as core fields.
- The meta-model in `.xomda/model.json` is itself fed back through the
  templates to regenerate `@xomda/core` — the self-bootstrap loop is the
  most demanding test of this discipline (see [Self-definition](#self-definition)).

## Where to go next

- [Data model](./data-model.md) — the precise schema of model.json.
- [Templates](./templates.md) — the cell-based template language.
- [Architecture](./ARCHITECTURE.md) — how the codebase is organised to support all of this.
