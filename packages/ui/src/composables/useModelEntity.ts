import type { Entity, Enum, Model, Package } from '@xomda/model'
import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue'

function findEntityInPackages(name: string, packages: Package[]): Entity | null {
  for (const pkg of packages) {
    const found = pkg.entities.find((e) => e.name === name)
    if (found) return found
    const inSub = findEntityInPackages(name, pkg.packages)
    if (inSub) return inSub
  }
  return null
}

function findEnumInPackages(name: string, packages: Package[]): Enum | null {
  for (const pkg of packages) {
    const found = pkg.enums.find((e) => e.name === name)
    if (found) return found
    const inSub = findEnumInPackages(name, pkg.packages)
    if (inSub) return inSub
  }
  return null
}

/**
 * Look up an Entity by name in the loaded model. Reactive — recomputes
 * when either the model or the name changes.
 */
export function useModelEntity(
  model: MaybeRefOrGetter<Model | null | undefined>,
  name: MaybeRefOrGetter<string>
): ComputedRef<Entity | null> {
  return computed(() => {
    const m = toValue(model)
    if (!m) return null
    const n = toValue(name)
    return findEntityInPackages(n, m.packages)
  })
}

/**
 * Look up an Enum by name in the loaded model. Mirrors useModelEntity.
 */
export function useModelEnum(
  model: MaybeRefOrGetter<Model | null | undefined>,
  name: MaybeRefOrGetter<string>
): ComputedRef<Enum | null> {
  return computed(() => {
    const m = toValue(model)
    if (!m) return null
    const n = toValue(name)
    return findEnumInPackages(n, m.packages)
  })
}
