import { z } from 'zod'

import type { Entity, EntityKind } from './entity'
import { getEntityKind } from './entity'
import { PackageSchema } from './package'
import { VersionsIndexSchema } from './version'

export const LayoutEntrySchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
})

// Open by design via `.loose()`: see EntitySchema for rationale.
export const ModelSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    name: z.string().default('Untitled Model'),
    version: z.string().default('1.0.0'),
    packages: z.array(PackageSchema).default([]),
    /**
     * Per-model version history index. Optional — legacy models parse
     * without it, and the project-level `ProjectFile.versions` still applies
     * as the fallback (Phase G migrates legacy project-level versions
     * down to per-model on read). New writes go here.
     */
    versions: VersionsIndexSchema.optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
    /** Canvas layout map: UUID → {x, y, width?, height?}. Stored in model.json but separate from model structure. */
    layout: z.record(z.string(), LayoutEntrySchema).optional(),
  })
  .loose()
  .superRefine((data, ctx) => {
    validateInheritance(data as Model, ctx)
  })
export type Model = z.infer<typeof ModelSchema>
export type LayoutEntry = z.infer<typeof LayoutEntrySchema>
export type Layout = Record<string, LayoutEntry>

// ─── Model-level inheritance validation ─────────────────────────────────────
//
// Validates extends / implements rules across all entities in the model.
// Cross-model targets (UUIDs not present in this model) are silently skipped
// — those are resolved at the project-graph layer. Same-model targets are
// validated here for kind compatibility and cycle freedom.

interface EntityWithPath {
  entity: Entity
  path: (string | number)[]
}

const collectEntitiesWithPath = (model: Model): EntityWithPath[] => {
  const out: EntityWithPath[] = []
  type PkgLike = (typeof model)['packages'][number]
  const walk = (pkgs: readonly PkgLike[], base: (string | number)[]): void => {
    pkgs.forEach((p, pi) => {
      const pkgPath = [...base, pi] as (string | number)[]
      p.entities.forEach((e, ei) => {
        out.push({ entity: e as Entity, path: [...pkgPath, 'entities', ei] })
      })
      walk(p.packages as readonly PkgLike[], [...pkgPath, 'packages'])
    })
  }
  walk(model.packages as readonly PkgLike[], ['packages'])
  return out
}

const ALLOWED_PARENT_KIND: Record<EntityKind, EntityKind> = {
  default: 'abstract',
  abstract: 'abstract',
  interface: 'interface',
}

function validateInheritance(model: Model, ctx: z.RefinementCtx): void {
  const all = collectEntitiesWithPath(model)
  const byId = new Map<string, EntityWithPath>()
  for (const item of all) byId.set(item.entity.id, item)

  for (const { entity, path } of all) {
    const childKind = getEntityKind(entity)

    if (entity.extends) {
      const target = byId.get(entity.extends)
      if (target !== undefined) {
        // Same-model target: validate kind compatibility. Cross-model targets
        // (target === undefined) are deferred to Phase F.
        const parentKind = getEntityKind(target.entity)
        if (parentKind !== ALLOWED_PARENT_KIND[childKind]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Entity of kind "${childKind}" can only extend an entity of kind "${ALLOWED_PARENT_KIND[childKind]}", but target "${target.entity.name}" is "${parentKind}"`,
            path: [...path, 'extends'],
          })
        }
      }
    }

    if (entity.implements) {
      entity.implements.forEach((targetId, idx) => {
        const target = byId.get(targetId)
        if (target !== undefined) {
          const targetKind = getEntityKind(target.entity)
          if (targetKind !== 'interface') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Entity.implements must target an entity of kind "interface", but "${target.entity.name}" is "${targetKind}"`,
              path: [...path, 'implements', idx],
            })
          }
        }
      })
    }
  }

  // Cycle detection over the combined extends + implements graph (within this
  // model). Cross-model edges are excluded by the same in-model filter above.
  type Color = 'white' | 'gray' | 'black'
  const color = new Map<string, Color>()
  for (const { entity } of all) color.set(entity.id, 'white')

  const edges = new Map<string, string[]>()
  for (const { entity } of all) {
    const out: string[] = []
    if (entity.extends && byId.has(entity.extends)) out.push(entity.extends)
    if (entity.implements) {
      for (const id of entity.implements) {
        if (byId.has(id)) out.push(id)
      }
    }
    edges.set(entity.id, out)
  }

  const dfs = (id: string, stack: string[]): string[] | null => {
    color.set(id, 'gray')
    stack.push(id)
    for (const next of edges.get(id) ?? []) {
      const c = color.get(next)
      if (c === 'gray') return [...stack, next]
      if (c === 'white') {
        const cycle = dfs(next, stack)
        if (cycle) return cycle
      }
    }
    stack.pop()
    color.set(id, 'black')
    return null
  }

  for (const { entity, path } of all) {
    if (color.get(entity.id) !== 'white') continue
    const cycle = dfs(entity.id, [])
    if (cycle) {
      const names = cycle.map((id) => byId.get(id)?.entity.name ?? id).join(' → ')
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Inheritance cycle detected: ${names}`,
        path: [...path, 'extends'],
      })
      break // one cycle finding is enough; further reporting just adds noise
    }
  }
}
