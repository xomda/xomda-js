import { useLocalStorageStore } from '@xomda/ui'
import { computed, onMounted, type Ref, ref, watch } from 'vue'

import { trpc } from '../../trpc'
import type { FileEntry, PreviewMap, TreeNode } from './types'
import { mergeWithVirtualEntries } from './useFolderEntries'

const BLOCKED_SEGMENTS = new Set(['node_modules', '.git', 'dist'])

const isBlockedPath = (path: string): boolean =>
  path.split('/').some((seg) => BLOCKED_SEGMENTS.has(seg))

export interface UseFolderTreeOptions {
  showHidden: Ref<boolean>
  showGenerated: Ref<boolean>
  previewMap: Ref<PreviewMap>
  currentPath: Ref<string>
}

export function useFolderTree(opts: UseFolderTreeOptions) {
  const store = useLocalStorageStore()

  const expanded = ref<Set<string>>(
    new Set(store.fileTreeExpanded.filter((p) => !isBlockedPath(p)))
  )

  watch(
    expanded,
    (set) => {
      store.fileTreeExpanded = Array.from(set)
        .filter((p) => !isBlockedPath(p))
        .sort()
    },
    { deep: true }
  )

  const cache = ref<Map<string, FileEntry[]>>(new Map())
  const loadingPaths = ref<Set<string>>(new Set())
  const errorPaths = ref<Set<string>>(new Set())

  const setAdd = <T,>(s: Set<T>, v: T): Set<T> => new Set([...s, v])
  const setDel = <T,>(s: Set<T>, v: T): Set<T> => {
    const n = new Set(s)
    n.delete(v)
    return n
  }

  async function fetchChildren(path: string): Promise<FileEntry[]> {
    if (loadingPaths.value.has(path)) return cache.value.get(path) ?? []
    loadingPaths.value = setAdd(loadingPaths.value, path)
    try {
      const result = await trpc.file.list.query({
        path,
        showHidden: opts.showHidden.value,
      })
      const next = new Map(cache.value)
      next.set(path, result)
      cache.value = next
      if (errorPaths.value.has(path)) errorPaths.value = setDel(errorPaths.value, path)
      return result
    } catch {
      errorPaths.value = setAdd(errorPaths.value, path)
      // Drop stale expansion if the folder no longer exists.
      if (expanded.value.has(path)) expanded.value = setDel(expanded.value, path)
      return []
    } finally {
      loadingPaths.value = setDel(loadingPaths.value, path)
    }
  }

  async function ensureLoaded(path: string): Promise<void> {
    if (cache.value.has(path) || loadingPaths.value.has(path)) return
    await fetchChildren(path)
  }

  async function expand(path: string): Promise<void> {
    if (!expanded.value.has(path)) expanded.value = setAdd(expanded.value, path)
    await ensureLoaded(path)
  }

  function collapse(path: string): void {
    if (expanded.value.has(path)) expanded.value = setDel(expanded.value, path)
  }

  function toggle(path: string): void {
    if (expanded.value.has(path)) collapse(path)
    else void expand(path)
  }

  /**
   * Expand strict ancestors of `path` (parents but not `path` itself) so the row
   * for `path` is visible. Leaving `path` itself out preserves user's collapse
   * intent if they just collapsed it.
   */
  async function ensureAncestorsExpanded(path: string): Promise<void> {
    if (!path || path === '.') return
    const segments = path.split('/')
    const ancestors: string[] = []
    for (let i = 0; i < segments.length - 1; i++) {
      ancestors.push(segments.slice(0, i + 1).join('/'))
    }
    if (ancestors.length === 0) return
    const next = new Set(expanded.value)
    for (const p of ancestors) next.add(p)
    expanded.value = next
    await Promise.all(ancestors.map(ensureLoaded))
  }

  onMounted(async () => {
    const initial = ['.', ...expanded.value]
    await Promise.all(initial.map(ensureLoaded))
    if (opts.currentPath.value && opts.currentPath.value !== '.') {
      await ensureAncestorsExpanded(opts.currentPath.value)
    }
  })

  watch(opts.currentPath, (path) => {
    if (path && path !== '.') void ensureAncestorsExpanded(path)
  })

  // showHidden is server-side filtered: clear cache and re-fetch all expanded paths.
  watch(opts.showHidden, async () => {
    cache.value = new Map()
    const toLoad = ['.', ...expanded.value]
    await Promise.all(toLoad.map((p) => fetchChildren(p)))
  })

  const visibleNodes = computed<TreeNode[]>(() => {
    const nodes: TreeNode[] = []

    function walk(path: string, depth: number): void {
      const real = cache.value.get(path) ?? []
      const merged = mergeWithVirtualEntries(
        real,
        opts.previewMap.value,
        path,
        opts.showGenerated.value
      )
      for (const entry of merged) {
        const childPath = path === '.' ? entry.name : `${path}/${entry.name}`
        const isExpanded = expanded.value.has(childPath)
        const isLoading = loadingPaths.value.has(childPath)
        nodes.push({ entry, path: childPath, depth, isExpanded, isLoading })
        if (entry.isDirectory && isExpanded) walk(childPath, depth + 1)
      }
    }

    walk('.', 0)
    return nodes
  })

  return {
    visibleNodes,
    expanded,
    loadingPaths,
    errorPaths,
    toggle,
    expand,
    collapse,
    ensureAncestorsExpanded,
  }
}
