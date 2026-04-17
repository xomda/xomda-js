import { z } from 'zod'

import { PackageSchema } from './package'

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
    elementsOrder: z.array(z.string().uuid()).optional(),
  })
  .loose()
export type Model = z.infer<typeof ModelSchema>
