import type { Entity, EntityKind, Model } from '@xomda/core'
import { getEntityKind } from '@xomda/core'

import type { FromContext } from './find'
import { findInProjectGraph } from './find'
import type { ProjectGraph } from './loader'

/**
 * Result of running cross-model validation against a project graph.
 * Findings are non-fatal at parse time (the schema-level superRefine already
 * accepts the model); callers (router procedures, codegen) surface them via
 * `useNotificationsStore` or fail the operation explicitly.
 */
export interface CrossModelValidationResult {
  violations: CrossModelViolation[]
}

export type CrossModelViolation =
  | {
      kind: 'extends-target-not-found'
      entityId: string
      entityName: string
      targetId: string
    }
  | {
      kind: 'extends-target-not-visible'
      entityId: string
      entityName: string
      targetId: string
    }
  | {
      kind: 'extends-target-wrong-kind'
      entityId: string
      entityName: string
      targetId: string
      targetKind: EntityKind
      requiredParentKind: EntityKind
    }
  | {
      kind: 'implements-target-not-found'
      entityId: string
      entityName: string
      targetId: string
    }
  | {
      kind: 'implements-target-not-visible'
      entityId: string
      entityName: string
      targetId: string
    }
  | {
      kind: 'implements-target-wrong-kind'
      entityId: string
      entityName: string
      targetId: string
      targetKind: EntityKind
    }
const ALLOWED_PARENT_KIND: Record<EntityKind, EntityKind> = {
  default: 'abstract',
  abstract: 'abstract',
  interface: 'interface',
}

/**
 * Validate a model against the project graph: every extends / implements
 * target either resolves locally (already checked by
 * ModelSchema.superRefine) or resolves through the project graph
 * with the right kind AND with adequate visibility from the consumer model.
 *
 * F5–F7 wiring: this is the post-parse pass that takes effect once the graph
 * is available. ModelSchema's superRefine deliberately defers cross-model
 * checks because Zod refinements are synchronous and the graph is built
 * asynchronously from disk.
 */
export function validateModelAgainstGraph(
  model: Model,
  graph: ProjectGraph
): CrossModelValidationResult {
  const violations: CrossModelViolation[] = []
  const fromContext: FromContext = { modelId: model.id }

  const localEntities = new Map<string, Entity>()
  type PkgLike = (typeof model)['packages'][number]
  const walkLocal = (pkgs: readonly PkgLike[]): void => {
    for (const p of pkgs) {
      for (const e of p.entities) localEntities.set(e.id, e as Entity)
      walkLocal(p.packages as readonly PkgLike[])
    }
  }
  walkLocal(model.packages as readonly PkgLike[])

  for (const entity of localEntities.values()) {
    const childKind = getEntityKind(entity)

    if (entity.extends && !localEntities.has(entity.extends)) {
      const target = findInProjectGraph(graph, entity.extends, fromContext)
      if (!target) {
        // Could be missing from graph or hidden by visibility — disambiguate.
        const present = graph.idIndex.has(entity.extends)
        violations.push(
          present
            ? {
                kind: 'extends-target-not-visible',
                entityId: entity.id,
                entityName: entity.name,
                targetId: entity.extends,
              }
            : {
                kind: 'extends-target-not-found',
                entityId: entity.id,
                entityName: entity.name,
                targetId: entity.extends,
              }
        )
      } else if (target.kind !== 'entity') {
        // Pointed at a non-entity (e.g. an enum) — also wrong.
        violations.push({
          kind: 'extends-target-wrong-kind',
          entityId: entity.id,
          entityName: entity.name,
          targetId: entity.extends,
          targetKind: 'default',
          requiredParentKind: ALLOWED_PARENT_KIND[childKind],
        })
      } else {
        const targetKind = getEntityKind(target.value)
        if (targetKind !== ALLOWED_PARENT_KIND[childKind]) {
          violations.push({
            kind: 'extends-target-wrong-kind',
            entityId: entity.id,
            entityName: entity.name,
            targetId: entity.extends,
            targetKind,
            requiredParentKind: ALLOWED_PARENT_KIND[childKind],
          })
        }
      }
    }

    if (entity.implements) {
      for (const targetId of entity.implements) {
        if (localEntities.has(targetId)) continue
        const target = findInProjectGraph(graph, targetId, fromContext)
        if (!target) {
          const present = graph.idIndex.has(targetId)
          violations.push(
            present
              ? {
                  kind: 'implements-target-not-visible',
                  entityId: entity.id,
                  entityName: entity.name,
                  targetId,
                }
              : {
                  kind: 'implements-target-not-found',
                  entityId: entity.id,
                  entityName: entity.name,
                  targetId,
                }
          )
        } else if (target.kind !== 'entity' || getEntityKind(target.value) !== 'interface') {
          violations.push({
            kind: 'implements-target-wrong-kind',
            entityId: entity.id,
            entityName: entity.name,
            targetId,
            targetKind: target.kind === 'entity' ? getEntityKind(target.value) : 'default',
          })
        }
      }
    }
  }

  return { violations }
}
