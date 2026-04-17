import { z } from 'zod'

import { VISIBILITY_VALUES } from '../visibility/index'
import { AttributeSchema } from './attribute'

/**
 * The three kinds an entity can take. `kind` is the source of truth.
 *
 * - `'default'`   — concrete, instantiable.
 * - `'abstract'`  — cannot be instantiated; only extended.
 * - `'interface'` — attribute bundle; implementing entities fold its
 *                   attributes into their effective attribute list.
 */
export const ENTITY_KINDS = ['default', 'abstract', 'interface'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

// Open by design via Zod `.loose()`: Tier-2 users may extend `Entity` (e.g.
// `SpecialEntity extends Entity` with extra fields). Unknown keys
// round-trip losslessly through the parse/serialize cycle.
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
    /**
     * Entity kind. Defaults to `'default'` on parse — every entity has
     * exactly one effective kind.
     */
    kind: z.enum(ENTITY_KINDS).default('default'),
    /**
     * UUIDs of Interface entities this entity implements. Each interface's
     * attributes are folded into this entity's effective attribute list
     * (see `getEffectiveAttributes`). Order matters for conflict
     * resolution — later in the list overrides earlier on attribute-name
     * conflict; the entity's own attributes always win.
     */
    implements: z.array(z.string().uuid()).optional(),
    /**
     * Visibility of this entity across the project graph. Absent ⇒ `'public'`
     * at resolve time (legacy elements default to public; new entities
     * created through the router default to `'package-private'`).
     */
    visibility: z.enum(VISIBILITY_VALUES).optional(),
  })
  .loose()
  .superRefine((data, ctx) => {
    // 1. Attribute names must be unique within the entity.
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

    // 2. `implements` UUIDs must be unique within the list.
    if (data.implements !== undefined) {
      const seen = new Set<string>()
      data.implements.forEach((id, index) => {
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate UUID in implements: "${id}"`,
            path: ['implements', index],
          })
        }
        seen.add(id)
      })
    }
  })

export type Entity = z.infer<typeof EntitySchema>

/** Stable accessor for the entity's kind. */
export const getEntityKind = (e: Pick<Entity, 'kind'>): EntityKind => e.kind

/** Effective implements list (empty array when the field is absent). */
export const getEntityImplements = (e: Pick<Entity, 'implements'>): string[] => e.implements ?? []
