import { z } from 'zod'

import { AttributeSchema } from './attribute'

// Open by design (`.passthrough()`): Tier-2 users may extend `Entity` (e.g.
// `SpecialEntity extends Entity` with extra fields). Unknown keys must
// round-trip losslessly through the Zod parse/serialize cycle.
export const EntitySchema = z
  .object({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    name: z.string().min(1),
    attributes: z.array(AttributeSchema).default([]),
    description: z.string().optional(),
    /** UUID of a parent Entity whose attributes are inherited. */
    extends: z.string().uuid().optional(),
    /** When true, the entity is a blueprint and should not be instantiated directly. */
    abstract: z.boolean().optional(),
  })
  .loose()
  .superRefine((data, ctx) => {
    const names = new Set<string>()
    data.attributes.forEach((attr, index) => {
      if (names.has(attr.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Attribute name "${attr.name}" must be unique within an entity`,
          path: ['attributes', index, 'name'],
        })
      }
      names.add(attr.name)
    })
  })

export type Entity = z.infer<typeof EntitySchema>
