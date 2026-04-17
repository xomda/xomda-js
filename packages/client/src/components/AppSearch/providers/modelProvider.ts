import type { Attribute, Entity, Enum, EnumValue, Model, Package } from '@xomda/core'
import { EntityIcon, EnumIcon, ModelIcon, PackageIcon } from '@xomda/icons'
import type { Router } from 'vue-router'

import { trpc } from '../../../trpc'
import type { SearchHit, SearchProvider } from './types'
import { createCache, scoreMatch } from './types'

interface IndexEntry {
  id: string
  name: string
  type: SearchHit['type']
  icon: string
  /** Dotted path of package names leading to this item (excluding the item itself). */
  path: string
  /** For attributes/enum values: id of the parent (entity/enum), used for selection context. */
  parentId?: string
  parentName?: string
}

function buildIndex(model: Model): IndexEntry[] {
  const out: IndexEntry[] = []

  const walkPackage = (pkg: Package, parentPath: string): void => {
    const here = parentPath ? `${parentPath}.${pkg.name}` : pkg.name
    out.push({ id: pkg.id, name: pkg.name, type: 'package', icon: PackageIcon, path: parentPath })
    for (const e of pkg.entities) walkEntity(e, here)
    for (const en of pkg.enums) walkEnum(en, here)
    for (const child of pkg.packages) walkPackage(child, here)
  }

  const walkEntity = (entity: Entity, path: string): void => {
    out.push({ id: entity.id, name: entity.name, type: 'entity', icon: EntityIcon, path })
    for (const attr of entity.attributes as Attribute[]) {
      out.push({
        id: attr.id,
        name: attr.name,
        type: 'attribute',
        icon: EntityIcon,
        path,
        parentId: entity.id,
        parentName: entity.name,
      })
    }
  }

  const walkEnum = (en: Enum, path: string): void => {
    out.push({ id: en.id, name: en.name, type: 'enum', icon: EnumIcon, path })
    for (const v of en.values as EnumValue[]) {
      out.push({
        id: v.id,
        name: v.name,
        type: 'enumValue',
        icon: EnumIcon,
        path,
        parentId: en.id,
        parentName: en.name,
      })
    }
  }

  for (const p of model.packages) walkPackage(p, '')
  return out
}

export function createModelProvider(router: Router, onNavigate: () => void): SearchProvider {
  const cache = createCache<IndexEntry[]>(async () => {
    const model = (await trpc.model.get.query()) as Model
    return buildIndex(model)
  })

  return {
    id: 'model',
    label: 'Model',
    async load() {
      await cache.get()
    },
    async search(query, signal) {
      const entries = await cache.get()
      if (signal.aborted) return []
      const hits: SearchHit[] = []
      for (const e of entries) {
        const score = scoreMatch(e.name, query)
        if (score <= 0) continue
        const subtitle = subtitleFor(e)
        hits.push({
          id: `model:${e.type}:${e.id}`,
          type: e.type,
          title: e.name,
          subtitle,
          icon: e.icon,
          score,
          navigate: () => {
            onNavigate()
            // Attributes/enum values: select their parent so the side panel opens on it.
            const selectId = e.parentId ?? e.id
            void router.push({ path: '/model', query: { select: selectId } })
          },
        })
      }
      return hits
    },
  }
}

function subtitleFor(e: IndexEntry): string | undefined {
  switch (e.type) {
    case 'package':
      return e.path || undefined
    case 'entity':
    case 'enum':
      return e.path || undefined
    case 'attribute':
      return e.parentName ? `${e.path ? `${e.path}.` : ''}${e.parentName}` : e.path
    case 'enumValue':
      return e.parentName ? `${e.path ? `${e.path}.` : ''}${e.parentName}` : e.path
    default:
      return undefined
  }
}

// Re-export for tests
export { buildIndex }
export const _modelIcons = { EntityIcon, EnumIcon, PackageIcon, ModelIcon }
