import type { Attribute } from '../schemas/attribute'
import type { Entity } from '../schemas/entity'
import type { Model } from '../schemas/model'
import type { Package } from '../schemas/package'

function collectAllEntities(model: Model): Entity[] {
  const out: Entity[] = []
  const walk = (pkgs: Package[]): void => {
    for (const p of pkgs) {
      out.push(...p.entities)
      walk(p.packages)
    }
  }
  walk(model.packages)
  return out
}

/**
 * Walk the `extends` chain from `entity`, returning the parent entities in
 * order from immediate parent to most distant ancestor. Stops at the first
 * cycle (the cycle-closing entity is not included) and silently ignores
 * dangling references.
 */
export function getEntityAncestors(entity: Entity, model: Model): Entity[] {
  const all = collectAllEntities(model)
  const byId = new Map(all.map((e) => [e.id, e]))
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
 * inherited from ancestors. Conflict resolution by name:
 *   own attribute  >  closer ancestor  >  more distant ancestor
 * Returned ancestor-first so own attributes appear last.
 */
export function getEffectiveAttributes(entity: Entity, model: Model): Attribute[] {
  const ancestors = getEntityAncestors(entity, model)
  const ownNames = new Set(entity.attributes.map((a) => a.name))
  const inherited: Attribute[] = []
  // Walk ancestors most-distant-first, replacing on name collision so closer
  // ancestors override more distant ones.
  for (const ancestor of [...ancestors].reverse()) {
    for (const attr of ancestor.attributes) {
      if (ownNames.has(attr.name)) continue
      const existingIdx = inherited.findIndex((a) => a.name === attr.name)
      if (existingIdx >= 0) {
        inherited[existingIdx] = attr
      } else {
        inherited.push(attr)
      }
    }
  }
  return [...inherited, ...entity.attributes]
}

/**
 * Returns just the inherited attributes for an entity (effective minus own).
 */
export function getInheritedAttributes(entity: Entity, model: Model): Attribute[] {
  const ownIds = new Set(entity.attributes.map((a) => a.id))
  return getEffectiveAttributes(entity, model).filter((a) => !ownIds.has(a.id))
}
