import type { Attribute } from '../schemas/attribute'
import type { Entity } from '../schemas/entity'
import type { Enum } from '../schemas/enum'
import type { Model } from '../schemas/model'
import type { Package } from '../schemas/package'

export function getAllPackages(model: Model): Package[] {
  const out: Package[] = []
  const walk = (pkgs: Package[]): void => {
    for (const p of pkgs) {
      out.push(p)
      walk(p.packages)
    }
  }
  walk(model.packages)
  return out
}

export function getAllEntities(model: Model): Entity[] {
  return getAllPackages(model).flatMap((p) => p.entities)
}

export function getAllEnums(model: Model): Enum[] {
  return getAllPackages(model).flatMap((p) => p.enums)
}

export function findEntityById(model: Model, id: string): Entity | undefined {
  return getAllEntities(model).find((e) => e.id === id)
}

/**
 * Find an Entity by name. The optional `extraEntities` parameter lets callers
 * extend the lookup beyond a single model — typically populated by the
 * project-graph layer with public entities visible from other models. The
 * primary model's entities always win on name collision (same-model lookups
 * are unaffected by cross-model extension).
 */
export function findEntityByName(
  model: Model,
  name: string,
  extraEntities?: ReadonlyArray<Entity>
): Entity | undefined {
  const localHit = getAllEntities(model).find((e) => e.name === name)
  if (localHit !== undefined) return localHit
  return extraEntities?.find((e) => e.name === name)
}

export function findEnumById(model: Model, id: string): Enum | undefined {
  return getAllEnums(model).find((e) => e.id === id)
}

/**
 * Find an Enum by name. See `findEntityByName` for the semantics of
 * `extraEnums`.
 */
export function findEnumByName(
  model: Model,
  name: string,
  extraEnums?: ReadonlyArray<Enum>
): Enum | undefined {
  const localHit = getAllEnums(model).find((e) => e.name === name)
  if (localHit !== undefined) return localHit
  return extraEnums?.find((e) => e.name === name)
}

export function findPackageById(model: Model, id: string): Package | undefined {
  return getAllPackages(model).find((p) => p.id === id)
}

export function findPackageByName(model: Model, name: string): Package | undefined {
  return getAllPackages(model).find((p) => p.name === name)
}

export function findAttributeByName(entity: Entity, name: string): Attribute | undefined {
  return entity.attributes.find((a) => a.name === name)
}

/**
 * Display-order convention: the `description` attribute is always pinned to
 * the end. Other attributes keep their array order, so drag-reorder over the
 * remaining rows still works as expected. Stable — returns a new array, never
 * mutates the input.
 */
export function sortAttributesForDisplay(attributes: Attribute[]): Attribute[] {
  const description: Attribute[] = []
  const rest: Attribute[] = []
  for (const a of attributes) {
    if (a.name === 'description') description.push(a)
    else rest.push(a)
  }
  return [...rest, ...description]
}

/** Find the package that directly contains the entity with this id. */
export function findEntityParentPackage(model: Model, entityId: string): Package | undefined {
  return getAllPackages(model).find((p) => p.entities.some((e) => e.id === entityId))
}

/** Find the package that directly contains the enum with this id. */
export function findEnumParentPackage(model: Model, enumId: string): Package | undefined {
  return getAllPackages(model).find((p) => p.enums.some((e) => e.id === enumId))
}
