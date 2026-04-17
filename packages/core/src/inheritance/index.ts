import { getAllEntities } from '../introspect/index'
import type { Attribute } from '../schemas/attribute'
import type { Entity } from '../schemas/entity'
import type { Model } from '../schemas/model'

/**
 * Walk the `extends` chain from `entity`, returning the parent entities in
 * order from immediate parent to most distant ancestor. Stops at the first
 * cycle (the cycle-closing entity is not included) and silently ignores
 * dangling references.
 */
export function getEntityAncestors(entity: Entity, model: Model): Entity[] {
  const byId = new Map(getAllEntities(model).map((e) => [e.id, e]))
  const ancestors: Entity[] = []
  const seen = new Set<string>([entity.id])
  let current: Entity | undefined = entity
  while (current?.extends) {
    if (seen.has(current.extends)) break
    const parent = byId.get(current.extends)
    if (!parent) break
    ancestors.push(parent)
    seen.add(parent.id)
    current = parent
  }
  return ancestors
}

/**
 * Returns all attributes effective on this entity: own attributes plus those
 * inherited from extends ancestors plus those folded in from implemented
 * interfaces. Conflict resolution by name (later in the merge wins):
 *
 *   own  >  later interface  >  earlier interface  >  closer ancestor  >  more
 *   distant ancestor
 *
 * Cross-model interface UUIDs (unresolved against this model) are silently
 * skipped — they are resolved at the project-graph layer.
 */
export function getEffectiveAttributes(entity: Entity, model: Model): Attribute[] {
  const byId = new Map(getAllEntities(model).map((e) => [e.id, e]))
  const ancestors = getEntityAncestors(entity, model)
  const result: Attribute[] = []
  const replaceOrAppend = (attr: Attribute): void => {
    const idx = result.findIndex((a) => a.name === attr.name)
    if (idx >= 0) {
      result[idx] = attr
    } else {
      result.push(attr)
    }
  }
  const foldImplements = (e: Pick<Entity, 'implements'>): void => {
    if (!e.implements) return
    for (const id of e.implements) {
      const iface = byId.get(id)
      if (!iface) continue // unresolved → deferred to project graph
      for (const attr of iface.attributes) replaceOrAppend(attr)
    }
  }

  // Walk extends ancestors most-distant-first so closer ancestors override.
  // At each ancestor level we also fold in that ancestor's interface
  // implements — composition is hereditary alongside extends inheritance.
  for (const ancestor of [...ancestors].reverse()) {
    for (const attr of ancestor.attributes) replaceOrAppend(attr)
    foldImplements(ancestor)
  }

  // Fold in the entity's own implements after the extends chain so its
  // interfaces win over inherited attributes on a name clash.
  foldImplements(entity)

  // Own attributes last — they always win.
  for (const attr of entity.attributes) replaceOrAppend(attr)

  return result
}

/**
 * Returns just the inherited attributes for an entity (effective minus own).
 */
export function getInheritedAttributes(entity: Entity, model: Model): Attribute[] {
  const ownIds = new Set(entity.attributes.map((a) => a.id))
  return getEffectiveAttributes(entity, model).filter((a) => !ownIds.has(a.id))
}
