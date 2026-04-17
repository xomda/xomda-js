import { z } from 'zod'

// Open by design (`.passthrough()`): Tier-2 users may extend `Attribute` (e.g.
// `SpecialAttribute extends Attribute` with extra fields). Unknown keys must
// round-trip losslessly through the Zod parse/serialize cycle.
export const AttributeSchema = z
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
     * When true and the attribute's `type` names another Entity (or other
     * non-primitive), the attribute stores a **reference by id** rather than
     * an embedded copy. Storage is the referenced element's UUID. Generated
     * schemas use `z.string().uuid()`, generated TypeScript types use `string`.
     * Default false (embedded).
     */
    reference: z.boolean().optional(),
    description: z.string().optional(),
    defaultValue: z.string().optional(),
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
 * `AttributeType` keeps autocomplete on the primitives while still accepting
 * any user-defined type name (an Entity or Enum). Pre-this-shape it was
 * `'string' | 'number' | … | string`, where the literal alternatives
 * collapsed to `string` and broke exhaustive switches. The `(string & {})`
 * trick preserves both the literal IntelliSense and the open-ended assignment.
 */
export type AttributeType = PrimitiveType | (string & {})

/** True if `t` is one of the built-in primitive type names. */
export const isPrimitiveType = (t: string): t is PrimitiveType =>
  (PRIMITIVE_TYPES as readonly string[]).includes(t)
