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
  })
  .loose()

export type Attribute = z.infer<typeof AttributeSchema>
export type AttributeType = 'string' | 'number' | 'boolean' | 'Date' | 'UUID' | 'decimal' | string
