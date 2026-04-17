import { z } from 'zod'

/**
 * UML 2 aggregation kinds recognised on an entity-typed attribute.
 *
 *   - `'composite'`: the parent **owns** the related instances. The child
 *     has no independent identity from the parent's perspective. In storage
 *     this materialises as an embedded copy (the JSON sub-tree).
 *   - `'none'`: ordinary association — the attribute stores a reference to
 *     a separately-owned entity (by id).
 *
 * Combined with `multiValue` this expresses all four common cardinalities
 * without inventing a new vocabulary:
 *
 *   | multiValue | aggregation   | Relationship           |
 *   |-----------:|---------------|------------------------|
 *   |       true | `'composite'` | one-to-many (composition) |
 *   |       true | `'none'`      | many-to-many (association)|
 *   |      false | `'composite'` | one-to-one (composition)  |
 *   |      false | `'none'`      | many-to-one (association) |
 *
 * Only meaningful when the attribute's `type` resolves to another Entity.
 * Setting it on a primitive type or the `'enum'` meta-type is a parse error
 * — primitives are always values, and enum *values* are not "owned" by the
 * containing entity.
 *
 * UML defines a third value, `'shared'`, but its semantics are explicitly
 * left under-specified by the spec; Xomda intentionally omits it.
 */
export const AGGREGATION_KINDS = ['composite', 'none'] as const
export type AggregationKind = (typeof AGGREGATION_KINDS)[number]

/**
 * Legacy → new mapping: `reference: boolean` was a storage hint that
 * conflated "stored by UUID" with "associated, not owned". This preprocess
 * migrates the wire format on read so the in-memory shape only carries the
 * new semantic `aggregation` field.
 *
 * Rules:
 *   - explicit `aggregation` wins; `reference` is dropped
 *   - `reference: true`  → `aggregation: 'none'`     (any non-primitive type)
 *   - `reference: false` → `aggregation: 'composite'` (any non-primitive non-enum type)
 *   - primitive / `'enum'` type → drop `reference`, leave aggregation unset
 */
const migrateLegacyReference = (input: unknown): unknown => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return input
  if (!('reference' in input)) return input
  const data = { ...(input as Record<string, unknown>) }
  const ref = data.reference
  const type = data.type
  delete data.reference
  if (data.aggregation !== undefined) return data
  if (typeof type !== 'string') return data
  if (isPrimitiveType(type) || type === 'enum') return data
  if (ref === true) data.aggregation = 'none'
  else if (ref === false) data.aggregation = 'composite'
  return data
}

// Open by design via Zod `.loose()`: Tier-2 users may extend `Attribute` (e.g.
// `SpecialAttribute extends Attribute` with extra fields). Unknown keys
// round-trip losslessly through the parse/serialize cycle.
const AttributeShape = z
  .object({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    name: z.string().min(1),
    type: z.string().min(1),
    required: z.boolean().default(false),
    multiValue: z.boolean().default(false),
    primaryKey: z.boolean().default(false),
    unique: z.boolean().default(false),
    /**
     * Scope for the `unique` flag, declaring how generated schemas should
     * enforce uniqueness:
     *   - `'global'` (default when `unique: true`): unique across all instances.
     *   - `'parent'`: unique among siblings within the parent container — i.e.
     *     code generation should emit a `superRefine` on the parent entity that
     *     checks this attribute's value across the relational child collection.
     */
    uniqueScope: z.enum(['global', 'parent']).optional(),
    /**
     * UML aggregation kind for an entity-typed attribute. See
     * {@link AGGREGATION_KINDS} for the full semantics. Only meaningful when
     * `type` resolves to an Entity; forbidden on primitive types and the
     * `'enum'` meta-type.
     *
     * When omitted on an entity-typed attribute, the runtime treats it as
     * composite (embedded) — this preserves legacy behaviour where
     * `reference` was unset. New attributes created via the UI seed the
     * field to `'none'` from the meta-model's `defaultValue`, which is the
     * idiomatic MDA default (a plain association).
     */
    aggregation: z.enum(AGGREGATION_KINDS).optional(),
    description: z.string().optional(),
    defaultValue: z.string().optional(),
    /**
     * UUID of the Entity this attribute references. Used (and required) when
     * `type === 'entity'`; ignored for other types. Resolves through the
     * project graph (visibility-aware in Phase F).
     */
    targetEntity: z.string().uuid().optional(),
    /**
     * UUID of the Enum this attribute references. Used (and required) when
     * `type === 'enum'`; ignored for other types.
     */
    targetEnum: z.string().uuid().optional(),
    /**
     * Maximum length for `type === 'string'` attributes. Optional codegen
     * hint — most stacks emit a `VARCHAR(length)` column or string-length
     * validator from it.
     */
    length: z.number().int().nonnegative().optional(),
    /**
     * Total digit count for `type === 'decimal'` attributes (the SQL
     * `precision`). Optional codegen hint.
     */
    precision: z.number().int().nonnegative().optional(),
    /**
     * Digits after the decimal point for `type === 'decimal'`. Optional
     * codegen hint; must not exceed `precision` when both are set
     * (enforced by `superRefine` in Phase E4).
     */
    scale: z.number().int().nonnegative().optional(),
    /**
     * Open container for sub-data attached to this attribute (e.g.
     * reference cascade rules, validation thresholds, framework-specific
     * column hints). Keeps the core `Attribute` shape generic — type-
     * specific configuration goes here instead of as flat fields on
     * every attribute.
     *
     * The values are intentionally unstructured at the schema level so
     * authors can extend with their own keys; downstream consumers
     * (templates, generated code) narrow with `as` at the use site.
     * Common conventions:
     *   - `validation`: `{ minLength?, maxLength?, pattern?, ... }`
     *   - `reference`:  `{ onDelete?: 'cascade' | 'restrict' | 'setNull', fkColumn? }`
     *   - `column`:     `{ name?, length?, precision?, scale? }`
     *
     * Empty `{}` and `undefined` are semantically equivalent (no config).
     */
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .loose()
  .superRefine((data, ctx) => {
    // Per-type extension-field rules. Setting an extension field on the
    // wrong type is a hard error; missing a target on a meta-type is left
    // permissive so cross-model / orphan cases can be reported by the
    // project-graph resolver (Phase F) rather than blocking the parse.
    if (data.targetEntity !== undefined && data.type !== 'entity') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `targetEntity is only valid when type is 'entity' (got '${data.type}')`,
        path: ['targetEntity'],
      })
    }
    if (data.targetEnum !== undefined && data.type !== 'enum') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `targetEnum is only valid when type is 'enum' (got '${data.type}')`,
        path: ['targetEnum'],
      })
    }
    if (data.length !== undefined && data.type !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `length is only valid when type is 'string' (got '${data.type}')`,
        path: ['length'],
      })
    }
    if (data.precision !== undefined && data.type !== 'decimal') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `precision is only valid when type is 'decimal' (got '${data.type}')`,
        path: ['precision'],
      })
    }
    if (data.scale !== undefined && data.type !== 'decimal') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `scale is only valid when type is 'decimal' (got '${data.type}')`,
        path: ['scale'],
      })
    }
    if (data.precision !== undefined && data.scale !== undefined && data.scale > data.precision) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `scale (${data.scale}) must not exceed precision (${data.precision})`,
        path: ['scale'],
      })
    }
    if (data.aggregation !== undefined) {
      // Aggregation is a relationship modifier — only meaningful for an
      // entity-typed attribute. Primitives are values; enum *values* are
      // not "owned" by the containing entity.
      if (isPrimitiveType(data.type) || data.type === 'enum') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `aggregation is only valid for entity-typed attributes (got '${data.type}')`,
          path: ['aggregation'],
        })
      }
    }
  })

export const AttributeSchema = z.preprocess(migrateLegacyReference, AttributeShape)

export type Attribute = z.infer<typeof AttributeSchema>

/**
 * The six built-in primitive type names accepted by the generator.
 * The wire format for `Attribute.type` is a flat string — anything that is
 * not a primitive is interpreted as the name of another Entity or Enum
 * (the attribute references that user-defined type).
 *
 * Canonical casing is **lowercase**: matches `.xomda/model.json` wire values
 * and the runtime dispatch in `@xomda/core/dynamic`. Legacy PascalCase
 * (`Date`/`UUID`) is no longer accepted — `isPrimitiveType('Date')` is false.
 */
export const PRIMITIVE_TYPES = ['string', 'number', 'boolean', 'date', 'uuid', 'decimal'] as const
export type PrimitiveType = (typeof PRIMITIVE_TYPES)[number]

/**
 * Meta-type names — recognised values of `Attribute.type` that refer to
 * Xomda's modelling primitives themselves (rather than primitives or
 * user-defined entities/enums). Useful inside the meta-model, where an
 * Attribute can declare it points at another Entity or Enum or even at a
 * Package or Attribute (used during self-bootstrap).
 *
 * - `'entity'`    — references an Entity by UUID via `targetEntity`.
 * - `'enum'`      — references an Enum by UUID via `targetEnum`.
 * - `'package'`   — references a Package by UUID (meta-only).
 * - `'attribute'` — references another Attribute (meta-only).
 */
export const META_TYPES = ['entity', 'enum', 'package', 'attribute'] as const
export type MetaType = (typeof META_TYPES)[number]

/**
 * All values recognised by the new Attribute-type enum: primitives plus
 * meta-types. The wire format for `Attribute.type` remains a plain string —
 * any value beyond this list is interpreted as the name of a user-defined
 * Entity or Enum, exactly as before. This constant is the authoritative list
 * of *recognised* values; legacy free-string references continue to parse.
 */
export const ATTRIBUTE_TYPES = [...PRIMITIVE_TYPES, ...META_TYPES] as const
export type AttributeTypeKind = (typeof ATTRIBUTE_TYPES)[number]

/**
 * `AttributeType` keeps autocomplete on the primitives + meta-types while
 * still accepting any user-defined type name (an Entity or Enum). The
 * `(string & {})` trick preserves both the literal IntelliSense and
 * open-ended assignment.
 */
export type AttributeType = AttributeTypeKind | (string & {})

/** True if `t` is one of the built-in primitive type names. */
export const isPrimitiveType = (t: string): t is PrimitiveType =>
  (PRIMITIVE_TYPES as readonly string[]).includes(t)

/** True if `t` is one of the meta-type names (entity, enum, package, attribute). */
export const isMetaType = (t: string): t is MetaType =>
  (META_TYPES as readonly string[]).includes(t)

/** True if `t` is a recognised AttributeTypeKind (primitive or meta). */
export const isAttributeTypeKind = (t: string): t is AttributeTypeKind =>
  (ATTRIBUTE_TYPES as readonly string[]).includes(t)
