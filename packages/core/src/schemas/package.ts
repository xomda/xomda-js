import { z } from 'zod'

import type { Entity } from './entity'
import { EntitySchema } from './entity'
import type { Enum } from './enum'
import { EnumSchema } from './enum'

export type Package = {
  id: string
  name: string
  packages: Package[]
  enums: Enum[]
  entities: Entity[]
  description?: string
}

// Open by design (`.passthrough()`): see EntitySchema for rationale.
export const PackageSchema: z.ZodType<Package> = z.lazy(() =>
  z
    .object({
      id: z
        .string()
        .uuid()
        .default(() => crypto.randomUUID()),
      name: z.string().min(1),
      packages: z.array(PackageSchema).default([]),
      enums: z.array(EnumSchema).default([]),
      entities: z.array(EntitySchema).default([]),
      description: z.string().optional(),
    })
    .loose()
    .superRefine((data, ctx) => {
      const names = new Set<string>()
      const checkUnique = (name: string, type: string, index: number, path: string) => {
        if (names.has(name)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Name "${name}" must be unique within a package (conflict with ${type})`,
            path: [path, index, 'name'],
          })
        }
        names.add(name)
      }

      data.packages.forEach((p, i) => checkUnique(p.name, 'another package', i, 'packages'))
      data.entities.forEach((e, i) => checkUnique(e.name, 'an entity', i, 'entities'))
      data.enums.forEach((e, i) => checkUnique(e.name, 'an enum', i, 'enums'))
    })
)
