import type { Version } from '@xomda/core'
import { HistoryIcon } from '@xomda/icons'
import type { Router } from 'vue-router'

import { trpc } from '../../../trpc'
import type { SearchHit, SearchProvider } from './types'
import { createCache, scoreMatch } from './types'

export function createVersionProvider(router: Router, onNavigate: () => void): SearchProvider {
  const cache = createCache<Version[]>(async () => trpc.model.listVersions.query())

  return {
    id: 'versions',
    label: 'Versions',
    async load() {
      await cache.get()
    },
    async search(query, signal) {
      const versions = await cache.get()
      if (signal.aborted) return []
      const hits: SearchHit[] = []
      for (const v of versions) {
        const formatted = formatTimestamp(v.timestamp)
        const score = Math.max(
          scoreMatch(v.label, query),
          scoreMatch(formatted, query),
          scoreMatch(v.message ?? '', query)
        )
        if (score <= 0) continue
        hits.push({
          id: `version:${v.id}`,
          type: 'version',
          title: v.label,
          subtitle: formatted,
          icon: HistoryIcon,
          score,
          navigate: () => {
            onNavigate()
            void router.push({ path: '/versions', query: { select: v.id } })
          },
        })
      }
      return hits
    },
  }
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}
