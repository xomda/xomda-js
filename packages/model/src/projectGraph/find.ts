import type { Visibility } from '@xomda/core'
import { getEffectiveVisibility, isVisibleFrom } from '@xomda/core'

import type { IndexEntry, ProjectGraph } from './loader'

/**
 * Identifies the consumer asking the resolver — the model and package chain
 * the lookup is *from*. Used to enforce visibility: same-model lookups bypass
 * the check; cross-model lookups consult the target's effective visibility.
 *
 * Omit to ignore visibility entirely (callers doing introspection or admin
 * listings). When omitted, all targets resolve regardless of visibility.
 */
export interface FromContext {
  modelId: string
  packageChainIds?: ReadonlyArray<string>
  projectAbsPath?: string
}

/**
 * Look up `id` across the merged project graph. When `from` is supplied,
 * the resolver applies visibility (`isVisibleFrom`) and returns `undefined`
 * for targets that exist but are not visible from the consumer context.
 * Returns `undefined` if the id is not in the graph.
 */
export function findInProjectGraph(
  graph: ProjectGraph,
  id: string,
  from?: FromContext
): IndexEntry | undefined {
  const entry = graph.idIndex.get(id)
  if (!entry) return undefined
  if (!from) return entry
  return isEntryVisible(entry, from) ? entry : undefined
}

/**
 * Same as `findInProjectGraph` but looks up by `name` within an optional
 * kind filter. Useful for legacy `Attribute.type` strings that name an
 * Entity / Enum at codegen time. Visibility check applied identically to
 * the by-id version.
 */
export function findByNameInProjectGraph(
  graph: ProjectGraph,
  name: string,
  kindFilter: IndexEntry['kind'] | IndexEntry['kind'][] | undefined,
  from?: FromContext
): IndexEntry | undefined {
  const allowedKinds =
    kindFilter === undefined ? null : new Set(Array.isArray(kindFilter) ? kindFilter : [kindFilter])

  for (const entry of graph.idIndex.values()) {
    if (entry.kind === 'attribute') continue // attributes don't have meaningful names for type resolution
    if (allowedKinds !== null && !allowedKinds.has(entry.kind)) continue
    const candidate = entry.value as { name?: string }
    if (candidate.name !== name) continue
    if (from && !isEntryVisible(entry, from)) continue
    return entry
  }
  return undefined
}

function isEntryVisible(entry: IndexEntry, from: FromContext): boolean {
  // Only entity / enum / package carry visibility today.
  // Attributes are visible iff their owning entity is — leave
  // that check to the caller working with the parent. Model has no
  // visibility; it's always at least public to its own project.
  if (entry.kind === 'model' || entry.kind === 'attribute') {
    return entry.model.id === from.modelId
  }

  const target = entry.value as { visibility?: Visibility }
  // Package-chain narrows the target's own visibility — most-restrictive wins.
  const effective = getEffectiveVisibility(target, collectPackageChain(entry))

  return isVisibleFrom({
    effective,
    targetModelId: entry.model.id,
    targetPackageId: entry.package?.id ?? null,
    consumerModelId: from.modelId,
    consumerPackageChainIds: from.packageChainIds ?? [],
    targetProjectId: entry.node.absPath,
    consumerProjectId: from.projectAbsPath,
  })
}

/**
 * Returns the package-chain (nearest-first) for an entry — used to compute
 * effective visibility against enclosing-package visibility narrowing.
 *
 * For a package-level entity the chain is `[entry.package, ...ancestors]`;
 * for a top-level entity the chain is empty (entity directly under the model).
 *
 * Uses the pre-built `node.packageParent` index (populated at graph-load
 * time) — chain construction is O(depth), not O(model size).
 */
function collectPackageChain(entry: IndexEntry): { visibility?: Visibility }[] {
  if (entry.kind === 'model' || entry.kind === 'attribute') return []
  const direct = entry.package
  if (!direct) return []

  const out: { visibility?: Visibility }[] = [direct]
  // Build an id → Package map for the entry's model — cheap O(packages) walk
  // amortised over the chain build that follows.
  const byId = new Map<string, NonNullable<typeof entry.package>>()
  const stack: NonNullable<typeof entry.package>[] = [...entry.model.packages]
  while (stack.length > 0) {
    const p = stack.pop() as NonNullable<typeof entry.package>
    byId.set(p.id, p)
    for (const sub of p.packages) stack.push(sub as NonNullable<typeof entry.package>)
  }

  let currentId: string | null = entry.node.packageParent.get(direct.id) ?? null
  while (currentId !== null) {
    const pkg = byId.get(currentId)
    if (!pkg) break
    out.push(pkg)
    currentId = entry.node.packageParent.get(currentId) ?? null
  }
  return out
}
