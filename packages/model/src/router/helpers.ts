import { TRPCError } from '@trpc/server'
import type { Entity, Enum, Model, Package } from '@xomda/core'

export type Container = Model | Package

/**
 * Narrows a `Container` to `Package`. Needed because the loose `Model` schema
 * has an index signature (`.loose()` for Tier-2 extensions), which prevents
 * TypeScript from cleanly narrowing `'entities' in container`.
 */
export function isPackage(container: Container): container is Package {
  return Array.isArray((container as Package).entities)
}

/** Recursively find a Package by id. Returns undefined if not found. */
export function findPackageById(packages: Package[], id: string): Package | undefined {
  for (const pkg of packages) {
    if (pkg.id === id) return pkg
    const nested = findPackageById(pkg.packages ?? [], id)
    if (nested) return nested
  }
  return undefined
}

/**
 * Get a container (Model root or a nested Package) by id. Used for package
 * operations: adding a sub-package can target the model root or a package.
 * Returns the model itself when packageId is undefined.
 * Throws TRPCError(NOT_FOUND) when packageId is provided but does not exist.
 */
export function getContainerById(model: Model, packageId?: string): Container {
  if (!packageId) return model
  const pkg = findPackageById(model.packages, packageId)
  if (!pkg) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Package ${packageId} not found` })
  }
  return pkg
}

/**
 * Get a Package by id. Used for operations that must target a package
 * (entity / enum add and move) — the model root cannot hold them.
 * Throws TRPCError when packageId is missing or does not exist.
 */
export function requirePackageById(model: Model, packageId: string | undefined): Package {
  if (!packageId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'packageId is required' })
  }
  const pkg = findPackageById(model.packages, packageId)
  if (!pkg) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Package ${packageId} not found` })
  }
  return pkg
}

/** Recursively find an Entity by id, anywhere in the model's package tree. */
export function findEntityById(model: Model, id: string): Entity | undefined {
  const visit = (pkg: Package): Entity | undefined => {
    const direct = (pkg.entities ?? []).find((e) => e.id === id)
    if (direct) return direct
    for (const child of pkg.packages ?? []) {
      const found = visit(child)
      if (found) return found
    }
    return undefined
  }
  for (const pkg of model.packages) {
    const found = visit(pkg)
    if (found) return found
  }
  return undefined
}

/** Recursively find an Enum by id, anywhere in the model's package tree. */
export function findEnumById(model: Model, id: string): Enum | undefined {
  const visit = (pkg: Package): Enum | undefined => {
    const direct = (pkg.enums ?? []).find((e) => e.id === id)
    if (direct) return direct
    for (const child of pkg.packages ?? []) {
      const found = visit(child)
      if (found) return found
    }
    return undefined
  }
  for (const pkg of model.packages) {
    const found = visit(pkg)
    if (found) return found
  }
  return undefined
}

/** Get an Entity by id or throw a tRPC NOT_FOUND error. */
export function requireEntityById(model: Model, id: string): Entity {
  const entity = findEntityById(model, id)
  if (!entity) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Entity ${id} not found` })
  }
  return entity
}

/** Get an Enum by id or throw a tRPC NOT_FOUND error. */
export function requireEnumById(model: Model, id: string): Enum {
  const en = findEnumById(model, id)
  if (!en) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Enum ${id} not found` })
  }
  return en
}

/**
 * Reorder a list of items by id, appending any items not present in
 * `orderedIds` at the end (preserving their original relative order).
 */
export function reorderByIds<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const reordered = orderedIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is T => item !== undefined)
  const orderedSet = new Set(orderedIds)
  const missing = items.filter((item) => !orderedSet.has(item.id))
  return [...reordered, ...missing]
}

/** Remove an id from a container's elementsOrder array (if present). */
export function removeFromElementsOrder(container: Container, id: string): void {
  container.elementsOrder = (container.elementsOrder ?? []).filter((e) => e !== id)
}

/** Append an id to a container's elementsOrder array. */
export function appendToElementsOrder(container: Container, id: string): void {
  container.elementsOrder = [...(container.elementsOrder ?? []), id]
}
