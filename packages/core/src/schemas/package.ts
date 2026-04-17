import { z } from 'zod'

import type { Visibility } from '../visibility/index'
import { VISIBILITY_VALUES } from '../visibility/index'
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
  visibility?: Visibility
}

// Open by design via `.loose()`: see EntitySchema for rationale.
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
      /**
       * Visibility of this package across the project graph. See the
       * Visibility doc in `@xomda/core/visibility`. Defaults to `'public'`
       * on read of a legacy package without the field; new packages created
       * through the router default to `'package-private'`.
       */
      visibility: z.enum(VISIBILITY_VALUES).optional(),
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
