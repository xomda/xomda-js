import type { Model, ModelDiff } from '@xomda/core'
import { getAllEntities, getAllEnums, getAllPackages } from '@xomda/core'

import { defineProcessor } from './defineProcessor'
import type { ProjectInfo } from './types'
import { createTemplateFn } from './utils'

export type LoopItem = Record<string, unknown>

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

function iterableToArray(value: unknown): unknown[] {
  if (value == null) return []
  if (Array.isArray(value)) return value
  if (typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
    const out: unknown[] = []
    for (const item of value as Iterable<unknown>) out.push(item)
    return out
  }
  return []
}

export interface CollectLoopOptions {
  source: string | undefined
  content: string
  model: Model
  diff?: ModelDiff
  scopeVariables?: Record<string, unknown>
  collectionObject?: unknown
  parentIndex?: number
  ctx?: Record<string, unknown>
  /**
   * Optional JS predicate (the body of `(item, index, model, $ctx, ...vars) => ...`).
   * Items for which the predicate returns a truthy value are kept. Applied
   * *after* the source resolves so it composes with every loop source
   * (entities, packages, diff-*, javascript, ...). Empty string = no filter.
   */
  filter?: string
  /**
   * Workspace lens: every model in the active project. Drives the `models`
   * loop source. Falls back to `[model]` when omitted so a `models` loop in
   * a single-model project iterates exactly once.
   */
  allModels?: Model[]
  /**
   * Workspace lens: every project visible to this render. Drives the
   * `projects` loop source. Falls back to a singleton wrapping the active
   * project so a `projects` loop in a single-project repo iterates once.
   */
  allProjects?: ProjectInfo[]
}

export async function collectLoopItems(options: CollectLoopOptions): Promise<unknown[]> {
  const {
    source,
    content,
    model,
    diff,
    scopeVariables = {},
    collectionObject,
    parentIndex = 0,
    ctx = {},
    filter,
    allModels,
    allProjects,
  } = options

  let items: unknown[]
  if (source === 'entities') items = getAllEntities(model)
  else if (source === 'enums') items = getAllEnums(model)
  else if (source === 'packages') items = getAllPackages(model)
  else if (source === 'models') {
    // Default to the singleton when the caller didn't surface the
    // workspace lens. A `models` loop in a single-model project
    // iterates exactly once — matches the user's mental model of "loop
    // over my models" producing one pass per model, not zero.
    items = (allModels ?? [model]) as unknown[]
  } else if (source === 'projects') {
    // Singleton fallback for the same reason as `models`. Wrap the
    // active model under a synthetic project so the `.models` shape is
    // available for inner loops even when no workspace was supplied.
    items =
      allProjects ??
      ([{ root: '.', name: 'current', isRoot: true, models: [model] }] as ProjectInfo[])
  } else if (source && source.startsWith('diff-')) items = collectDiffItems(source, diff)
  else if (source === 'javascript' && content.trim()) {
    // The user's code is the *body* of an outer function. Its return value is
    // either an iterable (used as-is) or a function (called with the
    // collection object and parent index to produce the iterable). In scope:
    //   model, diff, $ctx, and each parent-loop variable by name.
    const scopeKeys = Object.keys(scopeVariables)
    const params = ['model', 'diff', '$ctx', ...scopeKeys]
    const fn = createTemplateFn(params, content)
    const collection = collectionObject !== undefined ? collectionObject : model
    const result = await fn(model, diff, ctx, ...scopeKeys.map((k) => scopeVariables[k]))
    if (typeof result === 'function') {
      const produced = await (result as (col: unknown, idx: number) => unknown)(
        collection,
        parentIndex
      )
      items = iterableToArray(produced)
    } else items = iterableToArray(result)
  } else items = []

  // Apply the optional predicate. We evaluate it once (sandboxed body that
  // returns a value per `item, index, ...`) and run it through Array#filter.
  // Keep iteration synchronous — async predicates aren't worth the cost
  // here; users wanting one can pre-compute via a `javascript` source.
  const expr = filter?.trim()
  if (!expr || items.length === 0) return items
  const scopeKeys = Object.keys(scopeVariables)
  const params = ['item', 'index', 'model', '$ctx', ...scopeKeys]
  const predicate = createTemplateFn(params, `return (${expr})`)
  const scopeValues = scopeKeys.map((k) => scopeVariables[k])
  const out: unknown[] = []
  for (let i = 0; i < items.length; i++) {
    const verdict = await predicate(items[i], i, model, ctx, ...scopeValues)
    if (verdict) out.push(items[i])
  }
  return out
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
