import type { Template, TemplateFolder } from '@xomda/core'
import { FolderIcon, TemplatesIcon } from '@xomda/icons'
import type { Router } from 'vue-router'

import { TemplatesRoutes } from '../../../modules/templates'
import { trpc } from '../../../trpc'
import type { SearchHit, SearchProvider } from './types'
import { createCache, scoreMatch } from './types'

interface TemplateData {
  templates: Template[]
  folders: TemplateFolder[]
}

const folderPathSegments = (path: string): string[] => (path ? path.split('/') : [])

export function createTemplateProvider(router: Router, onNavigate: () => void): SearchProvider {
  const cache = createCache<TemplateData>(async () => {
    const [templates, folders] = await Promise.all([
      trpc.template.list.query(),
      trpc.template.listFolders.query(),
    ])
    return { templates, folders }
  })

  return {
    id: 'templates',
    label: 'Templates',
    async load() {
      await cache.get()
    },
    async search(query, signal) {
      const data = await cache.get()
      if (signal.aborted) return []
      const hits: SearchHit[] = []

      for (const t of data.templates) {
        const score = scoreMatch(t.name, query)
        if (score <= 0) continue
        const folder = t.folder ?? ''
        hits.push({
          id: `template:${t.uuid}`,
          type: 'template',
          title: t.name,
          subtitle: folder || undefined,
          icon: TemplatesIcon,
          score,
          navigate: () => {
            onNavigate()
            void router.push({
              name: TemplatesRoutes.view,
              params: { folderPath: folderPathSegments(folder) },
              query: { template: t.uuid },
            })
          },
        })
      }

      for (const f of data.folders) {
        const score = scoreMatch(f.name, query)
        if (score <= 0) continue
        const parent = f.path.split('/').slice(0, -1).join('/')
        hits.push({
          id: `templateFolder:${f.path}`,
          type: 'templateFolder',
          title: f.name,
          subtitle: parent || undefined,
          icon: FolderIcon,
          score,
          navigate: () => {
            onNavigate()
            void router.push({
              name: TemplatesRoutes.view,
              params: { folderPath: folderPathSegments(f.path) },
            })
          },
        })
      }

      return hits
    },
  }
}
