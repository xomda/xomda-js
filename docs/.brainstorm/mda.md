# MDA

> **Status — non-authoritative brainstorm.** This file is the founder's
> original design note. Current behaviour and schema live in
> [concepts.md](../concepts.md) and [data-model.md](../data-model.md).
> Open questions and contradictions here are tracked inline with
> `> **[Resolution YYYY-MM-DD]** ...` blocks — the original prose is
> never deleted.

## Concepts and spirit

Below follow a list of facts about xomda and how it is an MDA framework, or application, or what’s in a name.
It contains information that needs to be known to AI agents, and needs to be maintained. this information can
either be dispersed in the current /docs folder documentation, or it may be added there to update the knowledge
base. this knowledge base is then used to help users and feed the AI agents. That help may come in the form of a
generated website, based upon the documentation and fragments of the codebase, let's say. Maybe the demo's too, linked
back to the github repo.

### Tests

Every requirement in this document needs to be verified by one or more tests. Test what's relevant.
Test the code that has been generated, for example.

### Brief description of the object model

- a model contains packages, entities, attributes, enums, enum values. All have a description (as last <text> attribute)
  and a <uuid> id, referencing happens using these id’s

  > **[Resolution 2026-05-22]** `model.json` is JSON, not XML; the `<text>` framing is a fossil from an earlier
  > serialisation. `description` is a plain optional string field on every type, and ids are UUIDs. See
  > [data-model.md](../data-model.md).

- Packages have a name, and can contain entities, enums and packages. So they can grow into a tree.
- An Entity contains attributes. It also has a name. It has a parent, if it extends from another entity.
- An Attribute has a name and an attribute type.
- An Enum has a name a should contain a list of Enum Values.
- An Enum Value has a name.
- Attribute Type is an enum that contains the different kinds of attribute types. An attribute can also be of the type
  Package, Entity, Attribute.

  > **[Resolution 2026-05-22]** Shipped. `ATTRIBUTE_TYPES` lists the recognised values: the six primitives
  > (`string number boolean date uuid decimal`) plus the four meta-types (`entity enum package attribute`).
  > The wire format for `Attribute.type` remains a plain string for backwards-compat — legacy entity-name
  > strings still parse and resolve by name at codegen time. New typed references use `targetEntity` /
  > `targetEnum` UUIDs alongside `type: 'entity' | 'enum'`. See [data-model.md](../data-model.md#attribute).

### Features and philosophy

- The object model “objects” are all building blocks of the model. Within the xomda code base, there are one or
  more .xomda folders that define one or more models. There are also code templates, that define the templates to
  generate the models, used within xomda itself.

  > **[Resolution 2026-05-22]** Multi-model is supported. A project has one primary model at `.xomda/model.json`
  > plus any number of secondary models at `.xomda/models/<id>.json`. Both kinds share the `Model` schema. See
  > [data-model.md](../data-model.md) and [concepts.md](../concepts.md#models-in-a-project).
- The object model “objects” are all Entities, except for Attribute Type, which is an Enum. An Attribute is an
  Entity, with as attributes: Id, Name, Attribute Type, Description, and so on. An Entity is an Entity with as
  attributes: Id, Name, Attributes, Description, and so on. An Enum is an entity with its own attribute list; Enum
  Value and Package follow the same pattern.
- Beyond the current definition of the model, an Attribute can also be extended, so that it can contain extra
  information, depending on the Attribute Type.

  > **[Resolution 2026-05-22]** Shipped via per-type extension fields on the `Attribute` schema: `targetEntity`,
  > `targetEnum`, `length` (for `string`), `precision` and `scale` (for `decimal`). Each is optional and only
  > valid on its paired type — enforced by `superRefine`. Tier-2 users can still add arbitrary extra fields
  > via Zod `.loose()` for round-trip-preserving open extension.
- An entity can be default, normal so to speak, or abstract, or blueprint.
  - Blueprints are like interfaces. They can be empty, just to “Tag” an object. (This may not be supported in languages
    like typescript, but then it’s up to the user not to use empty blueprint entities)
  - Abstract entities cannot be instantiated, only extended. Entities can only extend abstract entities.

  > **[Resolution 2026-05-22]** The brainstorm's three-kind idea ships as `Entity.kind`:
  > `default | abstract | interface`. The brainstorm's term "blueprint" maps to the **interface** kind today
  > (typed contract). A separate concept also called **Blueprint** has been introduced for *shared attribute
  > bundles* — these are not entity kinds, they sit alongside Entity / Enum / Package as model elements that
  > entities can `include`. See [concepts.md](../concepts.md#inheritance-references-and-blueprints) and
  > [data-model.md](../data-model.md#entity).
- The forms in the application are generated dynamically based upon this model.
- A user can extend the model himself too. If then he would like to extend Attribute for example, he should then choose
  the correct extended Attribute entity.
  - At this point, we required for an entity to be abstract to be extended. But the question is should it be
    allowed or not? Should a user be able to extend entity, so that it can contain extra attributes for example? He can
    then add functionality, or some form of plugin can do that maybe? Or add blueprints to it?

    > **[Resolution 2026-05-22]** Decided: only entities of kind `abstract` or `interface` may be extended. Default
    > (concrete) entities cannot be extended — a `Default` cannot serve as a parent in `extends`. Cross-cutting reuse
    > of attributes across unrelated entities is served by **Blueprints** (a separate concept introduced alongside
    > the kind work) — they are bundles of attributes that any entity can `include`. See
    > [concepts.md](../concepts.md#inheritance-references-and-blueprints) and [data-model.md](../data-model.md#entity).
- The model that the user loads and saves, is parsed based upon the model that is defined within xomda and/or the custom
  extensions to that model, should the user choose his own extended xomda entities, for example. Maybe that is even a
  good pattern to do.

  > **[Resolution 2026-05-22]** Shipped. The meta-model in `.xomda/model.json` IS the parser shape — every
  > meta-type (`Entity`, `Attribute`, `Package`, …) declares itself there and the codegen produces the Zod
  > schemas that parse user models. Tier-2 users extend by adding open fields (`.loose()` makes them
  > round-trip losslessly) and by declaring their own Blueprints / Interfaces / Abstracts within their
  > model.
- The xomda project has a name, a version (which is special, it’s a semver, I’m still in dubious whether the templates
  should handle this, or the model itself. The project can contain multiple models

  > **[Resolution 2026-05-22]** Confirmed: a project hosts a primary model plus secondary models — see
  > [concepts.md](../concepts.md#models-in-a-project). The brainstorm's "multiple models" intent is shipped today.
  > Cross-model references and project-graph inheritance (the next bullet's "parent's project up until root") are
  > tackled in a later phase of the reconciliation plan.

  > **[Resolution 2026-05-22]** Decided: `version` lives on `Model`. Templates do not own it. The `Model` schema
  > carries a semver `version` field — see [data-model.md](../data-model.md#model).
- Models should be able to reference other models. For multi-projects, I’d set the starting point at being able to
  extend from a parent’s project  (up until root). Reference is still done with <uuid> id’s so there should not be two
  whatever’s in the model with the same uuid. Not even in a different category so to speak.

  > **[Resolution 2026-05-22]** Shipped. `ProjectFile.parentProject` carries an optional relative path to a
  > parent xomda project; the project-graph loader walks the chain (default depth 32) and merges UUIDs across
  > projects. Cross-model `extends`, `implements`, and `includes` resolve through the graph with visibility
  > gating. Path-traversal is guarded by `settings.restrictReadsToProjectRoot` (default true) and a
  > `.xomda/` directory check. UUID collisions across projects surface as warnings (last write wins). See
  > `packages/model/src/projectGraph/`.
- A package and an Entity should also have a modifier, let’s say. Making them public, or package private, model
  private.

  > **[Resolution 2026-05-22]** Shipped. Three-level visibility on Entity, Package, and Blueprint:
  > `public | package-private | model-private`. Legacy elements (no `visibility` key) default to `public` on
  > read; new elements created via the router default to `package-private`. Effective visibility narrows
  > against the containing-package chain (most-restrictive wins). Cross-model and cross-project lookups
  > enforce the rule via `isVisibleFrom`. See [concepts.md](../concepts.md) and the visibility resolver in
  > `@xomda/core/visibility`.

### Within the Xomda project

- So the model in .xomda, must be complete enough, to be able to reproduce itself. .xomda model → template → generated
  code → xomda uses this code within its own codebase to determine how an end user can use this model for his own
  application. Within xomda itself, it will determine which attributes an Attribute, an Entity, or a package has —
  see [data-model.md](../data-model.md) for the canonical field list per meta-type.
- The templates should also define and generate the object models of the xomda integrations (in /integrations).
  - Whatever that is relevant, is model-dependent and can be generated, should be generated.

  > **[Resolution 2026-05-22]** The current JVM integration (`integrations/jvm/generator-core`) consumes
  > model.json via generic `Map`/`Iterable` access in `Helpers.java` rather than typed DTOs — so additive
  > schema changes (kind, implements, includes, visibility, blueprints, the attribute extension fields) pass
  > through without breaking the JVM side. Strongly-typed JVM DTOs and template-author APIs for the new
  > fields remain a follow-up integration task.
