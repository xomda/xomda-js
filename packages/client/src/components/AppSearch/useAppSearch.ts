import { computed, onUnmounted, ref, watch } from 'vue'

import type { SearchHit, SearchProvider } from './providers'

export interface SearchGroup {
  providerId: SearchProvider['id']
  label: string
  hits: SearchHit[]
}

export interface UseAppSearchOptions {
  providers: SearchProvider[]
  /** ms to wait after the last keystroke before dispatching. */
  debounceMs?: number
  /** Max hits per provider after ranking. */
  hitsPerGroup?: number
}

export function useAppSearch(opts: UseAppSearchOptions) {
  const debounceMs = opts.debounceMs ?? 120
  const hitsPerGroup = opts.hitsPerGroup ?? 10

  const query = ref('')
  const groups = ref<SearchGroup[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let activeController: AbortController | null = null

  const totalHits = computed(() => groups.value.reduce((n, g) => n + g.hits.length, 0))

  function clearTimer() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function cancelInflight() {
    if (activeController) {
      activeController.abort()
      activeController = null
    }
  }

  async function dispatch(q: string) {
    cancelInflight()
    if (!q.trim()) {
      groups.value = []
      loading.value = false
      error.value = null
      return
    }
    const controller = new AbortController()
    activeController = controller
    loading.value = true
    error.value = null
    try {
      const settled = await Promise.all(
        opts.providers.map(async (p) => {
          try {
            const hits = await p.search(q, controller.signal)
            return { provider: p, hits, error: null as string | null }
          } catch (e) {
            return {
              provider: p,
              hits: [] as SearchHit[],
              error: e instanceof Error ? e.message : 'Search failed',
            }
          }
        })
      )
      if (controller.signal.aborted) return
      const next: SearchGroup[] = []
      const errs: string[] = []
      for (const r of settled) {
        if (r.error) errs.push(`${r.provider.label}: ${r.error}`)
        const sorted = [...r.hits].sort((a, b) => b.score - a.score).slice(0, hitsPerGroup)
        if (sorted.length > 0)
          next.push({ providerId: r.provider.id, label: r.provider.label, hits: sorted })
      }
      groups.value = next
      error.value = errs.length > 0 ? errs.join('; ') : null
    } finally {
      if (activeController === controller) {
        activeController = null
        loading.value = false
      }
    }
  }

  watch(query, (q) => {
    clearTimer()
    debounceTimer = setTimeout(() => {
      void dispatch(q)
    }, debounceMs)
  })

  async function refresh(): Promise<void> {
    await Promise.all(opts.providers.map((p) => p.load().catch(() => undefined)))
  }

  function reset(): void {
    clearTimer()
    cancelInflight()
    query.value = ''
    groups.value = []
    error.value = null
    loading.value = false
  }

  onUnmounted(() => {
    clearTimer()
    cancelInflight()
  })

  return { query, groups, loading, error, totalHits, refresh, reset }
}
