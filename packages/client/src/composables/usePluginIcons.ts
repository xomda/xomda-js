import { getIconForPlugin } from '@xomda/analysis-client'
import type { MultiIconEntry } from '@xomda/ui'
import { type Ref, ref, watch } from 'vue'

import { trpc } from '../trpc'

interface FileTypesForResult {
  matches: Array<{
    pluginId: string
    pluginIcon?: string
    fileType: { id: string; label: string }
  }>
}

/**
 * Resolve the icons for a list of file paths. For each path we query
 * `project.fileTypesFor` (tRPC's batch link rolls neighbouring calls
 * together) and map every matching plugin to a MultiIconEntry. Empty
 * result → undefined so callers can decide whether to fall back to
 * their default icon.
 */
export function usePluginIcons(paths: Ref<string[]>) {
  const iconsByPath = ref<Map<string, MultiIconEntry[]>>(new Map())

  const cache = new Map<string, MultiIconEntry[]>()
  let pending = new Set<string>()
  let runSeq = 0

  async function resolveOne(path: string): Promise<MultiIconEntry[]> {
    const result = (await trpc.project.fileTypesFor.query({
      path,
    })) as FileTypesForResult
    const seen = new Set<string>()
    const out: MultiIconEntry[] = []
    for (const match of result.matches) {
      if (seen.has(match.pluginId)) continue
      seen.add(match.pluginId)
      const icon = getIconForPlugin(match.pluginId)
      if (icon) out.push({ icon, label: match.fileType.label })
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
          // ignore — file may have vanished or path is unresolvable
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
