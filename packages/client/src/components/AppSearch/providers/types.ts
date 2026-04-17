export type SearchHitType =
  | 'package'
  | 'entity'
  | 'enum'
  | 'enumValue'
  | 'attribute'
  | 'template'
  | 'templateFolder'
  | 'version'

export interface SearchHit {
  id: string
  type: SearchHitType
  title: string
  subtitle?: string
  icon: string
  score: number
  navigate: () => void
}

export interface SearchProvider {
  id: 'model' | 'templates' | 'versions'
  label: string
  load(): Promise<void>
  search(query: string, signal: AbortSignal): Promise<SearchHit[]>
}

const CACHE_TTL_MS = 30_000

export function createCache<T>(loader: () => Promise<T>) {
  let value: T | null = null
  let loadedAt = 0
  let inflight: Promise<T> | null = null

  return {
    async get(): Promise<T> {
      const fresh = value !== null && Date.now() - loadedAt < CACHE_TTL_MS
      if (fresh) return value as T
      if (inflight) return inflight
      inflight = loader()
        .then((v) => {
          value = v
          loadedAt = Date.now()
          inflight = null
          return v
        })
        .catch((e) => {
          inflight = null
          throw e
        })
      return inflight
    },
    invalidate(): void {
      value = null
      loadedAt = 0
    },
  }
}

/**
 * Case-insensitive ranking: prefix match > word-start match > substring match.
 * Returns 0 when there is no match.
 */
export function scoreMatch(haystack: string, needle: string): number {
  if (!needle) return 0
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (h === n) return 1000
  if (h.startsWith(n)) return 500 - Math.min(haystack.length, 100)
  const wordStart = new RegExp(`(?:^|[\\s._/-])${escapeRegExp(n)}`).test(h)
  if (wordStart) return 250 - Math.min(haystack.length, 100)
  const idx = h.indexOf(n)
  if (idx >= 0) return 100 - idx - Math.min(haystack.length, 50)
  return 0
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
