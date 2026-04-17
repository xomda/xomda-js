import type { Model, ModelDiff } from '@xomda/core'

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

function collectDiffItems(source: string, diff: ModelDiff | undefined): unknown[] {
  if (!diff) return []
  switch (source) {
    case 'diff-added-entities':
      return diff.added.entities
    case 'diff-removed-entities':
      return diff.removed.entities
    case 'diff-renamed-entities':
      return diff.renamed.entities
    case 'diff-modified-entities':
      return diff.modified.entities
    case 'diff-added-attributes':
      return diff.added.attributes
    case 'diff-removed-attributes':
      return diff.removed.attributes
    case 'diff-renamed-attributes':
      return diff.renamed.attributes
    case 'diff-modified-attributes':
      return diff.modified.attributes
    case 'diff-added-enums':
      return diff.added.enums
    case 'diff-removed-enums':
      return diff.removed.enums
    case 'diff-renamed-enums':
      return diff.renamed.enums
    case 'diff-modified-enums':
      return diff.modified.enums
    case 'diff-added-enum-values':
      return diff.added.enumValues
    case 'diff-removed-enum-values':
      return diff.removed.enumValues
    case 'diff-renamed-enum-values':
      return diff.renamed.enumValues
    case 'diff-added-packages':
      return diff.added.packages
    case 'diff-removed-packages':
      return diff.removed.packages
    case 'diff-renamed-packages':
      return diff.renamed.packages
    case 'diff-modified-packages':
      return diff.modified.packages
    default:
      return []
  }
}

async function collectItems(
  source: string | undefined,
  content: string,
  model: Model,
  diff?: ModelDiff
): Promise<unknown[]> {
  if (source === 'entities') return getAllEntities(model)
  if (source === 'enums') return getAllEnums(model)
  if (source === 'packages') return getAllPackages(model)
  if (source && source.startsWith('diff-')) return collectDiffItems(source, diff)
  if (source === 'javascript' && content.trim()) {
    // content should define a generator function named 'provide' or 'provide*'
    // we wrap it and call it, collecting results
    const body = `
      ${content}
      const gen = typeof provide !== 'undefined' ? provide(model, diff) : [];
      const result = [];
      for (const item of gen) { result.push(item); }
      return result;
    `
    const fn = createSandboxedFn(['model', 'diff'], body)
    const result = await fn(model, diff)
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
