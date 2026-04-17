import { TRPCError } from '@trpc/server'
import type { Entity, Enum, Model, Package } from '@xomda/core'
import { findEntityById, findEnumById, findPackageById } from '@xomda/core'

// Re-export the canonical pure tree-walkers from @xomda/core so router code has
// a single import surface; the router-specific helpers below add tRPC error
// handling on top.
export { findEntityById, findEnumById, findPackageById }

export type Container = Model | Package

/**
 * Narrows a `Container` to `Package`. Needed because the loose `Model` schema
 * has an index signature (`.loose()` for Tier-2 extensions), which prevents
 * TypeScript from cleanly narrowing `'entities' in container`.
 */
export function isPackage(container: Container): container is Package {
  return Array.isArray((container as Package).entities)
}

/**
 * Get a container (Model root or a nested Package) by id. Used for package
 * operations: adding a sub-package can target the model root or a package.
 * Returns the model itself when packageId is undefined.
 * Throws TRPCError(NOT_FOUND) when packageId is provided but does not exist.
 */
export function getContainerById(model: Model, packageId?: string): Container {
  if (!packageId) return model
  const pkg = findPackageById(model, packageId)
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
  const pkg = findPackageById(model, packageId)
  if (!pkg) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Package ${packageId} not found` })
  }
  return pkg
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

/**
 * Replace an Entity in the package tree by id. Returns true if a replacement
 * happened, false if no Entity with that id exists in the model.
 */
export function replaceEntityById(model: Model, replacement: Entity): boolean {
  const visit = (packages: Package[]): boolean => {
    for (const pkg of packages) {
      const idx = (pkg.entities ?? []).findIndex((e) => e.id === replacement.id)
      if (idx !== -1) {
        pkg.entities![idx] = replacement
        return true
      }
      if (visit(pkg.packages ?? [])) return true
    }
    return false
  }
  return visit(model.packages)
}

/**
 * Replace an Enum in the package tree by id. Returns true if a replacement
 * happened, false if no Enum with that id exists in the model.
 */
export function replaceEnumById(model: Model, replacement: Enum): boolean {
  const visit = (packages: Package[]): boolean => {
    for (const pkg of packages) {
      const idx = (pkg.enums ?? []).findIndex((e) => e.id === replacement.id)
      if (idx !== -1) {
        pkg.enums![idx] = replacement
        return true
      }
      if (visit(pkg.packages ?? [])) return true
    }
    return false
  }
  return visit(model.packages)
}

/** Remove an Entity from the package tree by id; returns the removed Entity or undefined. */
export function removeEntityById(model: Model, id: string): Entity | undefined {
  const visit = (pkg: Package): Entity | undefined => {
    const idx = (pkg.entities ?? []).findIndex((e) => e.id === id)
    if (idx !== -1) return pkg.entities!.splice(idx, 1)[0]
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

/** Remove an Enum from the package tree by id; returns the removed Enum or undefined. */
export function removeEnumById(model: Model, id: string): Enum | undefined {
  const visit = (pkg: Package): Enum | undefined => {
    const idx = (pkg.enums ?? []).findIndex((e) => e.id === id)
    if (idx !== -1) return pkg.enums!.splice(idx, 1)[0]
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

/**
 * Remove a Package from anywhere in the container tree (model root or another
 * package's `packages`) by id. Returns the removed Package or undefined.
 */
export function removePackageById(model: Model, id: string): Package | undefined {
  const visit = (container: Container): Package | undefined => {
    const pkgs = container.packages ?? []
    const idx = pkgs.findIndex((p) => p.id === id)
    if (idx !== -1) return pkgs.splice(idx, 1)[0]
    for (const pkg of pkgs) {
      const found = visit(pkg)
      if (found) return found
    }
    return undefined
  }
  return visit(model)
}

/** Returns true if `descendant` is `ancestor` or appears anywhere in its subtree. */
export function isPackageDescendantOf(ancestor: Package, descendant: Package): boolean {
  if (ancestor.id === descendant.id) return true
  return (ancestor.packages ?? []).some((sub) => isPackageDescendantOf(sub, descendant))
}
