import { getColorForPlugin, getIconForPlugin } from '@xomda/analysis-client'
import type { MultiIconEntry } from '@xomda/ui'
import { createLogger } from '@xomda/util'
import { type Ref, ref, watch } from 'vue'

import { trpc } from '../trpc'

const logger = createLogger('usePluginIcons')

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
    const result = await trpc.project.fileTypesFor.query({ path })
    const seen = new Set<string>()
    const out: MultiIconEntry[] = []
    for (const match of result.matches) {
      if (seen.has(match.pluginId)) continue
      seen.add(match.pluginId)
      const icon = getIconForPlugin(match.pluginId)
      if (icon) {
        const color = getColorForPlugin(match.pluginId)
        out.push({ icon, label: match.fileType.label, ...(color ? { color } : {}) })
      }
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
        } catch (e) {
          // File may have vanished or path is unresolvable — preserve any
          // previously-rendered icon by not writing to `next`, but log so
          // the underlying tRPC failure surfaces in LogsView.
          logger.debug('plugin icon resolution failed', { data: { path, error: e } })
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

  /**
   * Drop the cache and re-resolve every path currently being watched. Used
   * by the file-browser refresh button after a server-side re-scan so
   * stale plugin matches don't survive the user-visible reload.
   */
  function clearAndReload() {
    cache.clear()
    iconsByPath.value = new Map()
    for (const p of paths.value) pending.add(p)
    if (pending.size > 0) void run()
  }

  return { iconsByPath, getIcons, clearAndReload }
}
