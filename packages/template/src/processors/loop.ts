import type { Model, ModelDiff } from '@xomda/core'

import { defineProcessor } from './defineProcessor'
import { createSandboxedFn } from './utils'

export type LoopItem = Record<string, unknown>

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

export async function collectLoopItems(
  source: string | undefined,
  content: string,
  model: Model,
  scopeVariables: Record<string, unknown> = {},
  diff?: ModelDiff
): Promise<unknown[]> {
  if (source === 'entities') return getAllEntities(model)
  if (source === 'enums') return getAllEnums(model)
  if (source === 'packages') return getAllPackages(model)
  if (source && source.startsWith('diff-')) return collectDiffItems(source, diff)
  if (source === 'javascript' && content.trim()) {
    // content should define a generator function named 'provide' or return an iterable.
    // The function receives model, diff, and the surrounding scope variables (so nested
    // loops can read outer-loop bindings via their name).
    const scopeKeys = Object.keys(scopeVariables)
    const body = `
      ${content}
      const gen = typeof provide !== 'undefined' ? provide(model, diff) : [];
      const result = [];
      for (const item of gen) { result.push(item); }
      return result;
    `
    const params = ['model', 'diff', ...scopeKeys]
    const fn = createSandboxedFn(params, body)
    const result = await fn(model, diff, ...scopeKeys.map((k) => scopeVariables[k]))
    if (Array.isArray(result)) return result
  }
  return []
}

// The loop cell processor is a no-op marker; the engine special-cases loop
// cells to drive iteration over `cell.children`. The entry exists so that
// PROCESSORS[cell.type] resolves to something for diagnostics.
export const loopProcessor = defineProcessor({
  type: 'loop',
  execute(_cell, _ctx) {
    // handled by engine
  },
})

// Deprecated: kept for callers that still import the legacy name.
export const collectProviderItems = (
  source: string | undefined,
  content: string,
  model: Model,
  diff?: ModelDiff
): Promise<unknown[]> => collectLoopItems(source, content, model, {}, diff)
