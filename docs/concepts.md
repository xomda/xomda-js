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

- **Model** — the root container; one per project.
- **Package** — a hierarchical namespace; packages can nest.
- **Entity** — a named data type with a list of typed attributes.
- **Attribute** — a single field on an entity, with a type, cardinality, and constraints.
- **Enum** — an enumeration with a fixed set of named values.

All types are open by design: tier-2 users can extend them with extra fields that round-trip losslessly through
serialization.

## Inheritance, references, and blueprints

A few patterns recur often enough that xomda treats them as first-class:

- **Inheritance.** An entity can declare `extends` pointing at another entity; the parent's attributes are inherited.
- **Abstract entities (blueprints).** Marking an entity `abstract` means it should not be instantiated directly; it
  exists to be extended.
- **Reference vs embed.** When an attribute's type names another entity, the attribute either _embeds_ a copy of that
  entity inline (the default) or _references_ it by id (`reference: true`). This lets the same model express both
  composition and association without two separate type systems.

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

## Where to go next

- [Data model](./data-model.md) — the precise schema of model.json.
- [Templates](./templates.md) — the cell-based template language.
- [Architecture](./architecture.md) — how the codebase is organised to support all of this.
