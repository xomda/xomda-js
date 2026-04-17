import { getIconForPlugin } from '@xomda/analysis-client'
import type { MultiIconEntry } from '@xomda/ui'
import { type Ref, ref, watch } from 'vue'

import { trpc } from '../trpc'

/**
 * Resolve project-kind icons for a list of folder paths. For each path
 * we ask `project.kindsFor` (tRPC's batch link rolls neighbouring
 * calls together) which plugins' projectKind marker exists at that
 * folder. Each match becomes one MultiIconEntry — folders claimed by
 * multiple kinds (e.g. Node + Maven) stack their icons.
 *
 * Empty result → undefined so callers can render the plain folder
 * glyph unmodified.
 */
export function useFolderProjectIcons(paths: Ref<string[]>) {
  const iconsByPath = ref<Map<string, MultiIconEntry[]>>(new Map())

  const cache = new Map<string, MultiIconEntry[]>()
  let pending = new Set<string>()
  let runSeq = 0

  async function resolveOne(path: string): Promise<MultiIconEntry[]> {
    const { kinds } = await trpc.project.kindsFor.query({ path })
    const seen = new Set<string>()
    const out: MultiIconEntry[] = []
    for (const k of kinds) {
      if (seen.has(k.pluginId)) continue
      seen.add(k.pluginId)
      const icon = getIconForPlugin(k.pluginId)
      if (icon) out.push({ icon, label: k.pluginId })
    }
    return out
  }

  async function run() {
    const seq = ++runSeq
    const targets = [...pending]
    pending = new Set()
    const next = new Map(iconsByPath.value)
    await Promise.all(
      targets.map(async (path) => {
        const cached = cache.get(path)
        if (cached) {
          next.set(path, cached)
          return
        }
        try {
          const icons = await resolveOne(path)
          cache.set(path, icons)
          next.set(path, icons)
        } catch {
          // ignore — folder may have been removed between listing and lookup
        }
      })
    )
    if (seq !== runSeq) return
    iconsByPath.value = next
  }

  watch(
    paths,
    (next) => {
      for (const p of next) {
        if (!cache.has(p)) pending.add(p)
      }
      if (pending.size > 0) void run()
    },
    { immediate: true }
  )

  const getIcons = (path: string): MultiIconEntry[] | undefined => iconsByPath.value.get(path)

  return { iconsByPath, getIcons }
}
