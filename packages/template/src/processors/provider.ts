import type { Model } from '@xomda/core'

import { defineProcessor } from './defineProcessor'
import { createSandboxedFn } from './utils'

export type ProviderItem = Record<string, unknown>

function getAllEntities(model: Model): unknown[] {
  const entities: unknown[] = []
  function walk(packages: Model['packages']): void {
    for (const pkg of packages) {
      entities.push(...(pkg.entities || []))
      walk(pkg.packages || [])
    }
  }
  walk(model.packages || [])
  return entities
}

function getAllEnums(model: Model): unknown[] {
  const enums: unknown[] = []
  function walk(packages: Model['packages']): void {
    for (const pkg of packages) {
      enums.push(...(pkg.enums || []))
      walk(pkg.packages || [])
    }
  }
  walk(model.packages || [])
  return enums
}

function getAllPackages(model: Model): unknown[] {
  const packages: unknown[] = []
  function walk(pkgs: Model['packages']): void {
    for (const pkg of pkgs) {
      packages.push(pkg)
      walk(pkg.packages || [])
    }
  }
  walk(model.packages || [])
  return packages
}

async function collectItems(
  source: string | undefined,
  content: string,
  model: Model
): Promise<unknown[]> {
  if (source === 'entities') return getAllEntities(model)
  if (source === 'enums') return getAllEnums(model)
  if (source === 'packages') return getAllPackages(model)
  if (source === 'javascript' && content.trim()) {
    // content should define a generator function named 'provide' or 'provide*'
    // we wrap it and call it, collecting results
    const body = `
      ${content}
      const gen = typeof provide !== 'undefined' ? provide(model) : [];
      const result = [];
      for (const item of gen) { result.push(item); }
      return result;
    `
    const fn = createSandboxedFn(['model'], body)
    const result = await fn(model)
    if (Array.isArray(result)) return result
  }
  return []
}

export const providerProcessor = defineProcessor({
  type: 'provider',
  execute(_cell, _ctx) {
    // provider cells are handled by the renderer — the processor itself is a no-op
    // The renderer detects provider cells and uses collectProviderItems() to loop
  },
})

export { collectItems as collectProviderItems }
