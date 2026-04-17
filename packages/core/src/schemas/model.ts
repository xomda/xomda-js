import { z } from 'zod'

import { PackageSchema } from './package'

export const LayoutEntrySchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
})

// Open by design (`.passthrough()`): see EntitySchema for rationale.
export const ModelSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    name: z.string().default('Untitled Model'),
    version: z.string().default('1.0.0'),
    packages: z.array(PackageSchema).default([]),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
    /** Canvas layout map: UUID → {x, y, width?, height?}. Stored in model.json but separate from model structure. */
    layout: z.record(z.string(), LayoutEntrySchema).optional(),
  })
  .loose()
export type Model = z.infer<typeof ModelSchema>
export type LayoutEntry = z.infer<typeof LayoutEntrySchema>
export type Layout = Record<string, LayoutEntry>
