import type { Template } from '@xomda/template'
import { useEditBuffer } from '@xomda/ui'
import { describe, expect, it } from 'vitest'
import { markRaw } from 'vue'

import { duplicateTemplate, findTabsInDeletedFolder } from '../TemplatesView.logic'
import type { OpenTemplateTab } from '../useTemplateTabs'

function makeTab(uuid: string, folder: string | undefined): OpenTemplateTab {
  const buffer = useEditBuffer<Template>()
  buffer.set({ uuid, name: uuid, version: '1.0.0', cells: [], ...(folder ? { folder } : {}) })
  return { uuid, buffer: markRaw(buffer) }
}

const baseTemplate = (overrides: Partial<Template> = {}): Template => ({
  uuid: 'src-uuid',
  name: 'Foo',
  version: '1.0.0',
  description: 'desc',
  scope: 'Entity',
  folder: 'java',
  cells: [{ uuid: 'cell-1', type: 'output', content: 'original' }],
  ...overrides,
})

describe('duplicateTemplate', () => {
  it('returns a copy with a fresh UUID, " (copy)" name, and all other fields preserved', () => {
    const source = baseTemplate()
    const result = duplicateTemplate(source, [source])

    expect(result.uuid).not.toBe(source.uuid)
    expect(result.uuid).toMatch(/^[0-9a-f-]{36}$/i)
    expect(result.name).toBe('Foo (copy)')
    expect(result.version).toBe(source.version)
    expect(result.description).toBe(source.description)
    expect(result.scope).toBe(source.scope)
    expect(result.folder).toBe(source.folder)
    expect(result.cells).toEqual(source.cells)
  })

  it('deep-clones cells so mutating the duplicate does not affect the source', () => {
    const source = baseTemplate()
    const result = duplicateTemplate(source, [source])

    expect(result.cells).not.toBe(source.cells)
    expect(result.cells[0]).not.toBe(source.cells[0])

    result.cells[0].content = 'mutated'
    expect(source.cells[0].content).toBe('original')
  })

  it('appends an incrementing suffix when the " (copy)" name is already taken', () => {
    const source = baseTemplate()
    const sibling1 = baseTemplate({ uuid: 'a', name: 'Foo (copy)' })
    const sibling2 = baseTemplate({ uuid: 'b', name: 'Foo (copy) 2' })

    expect(duplicateTemplate(source, [source, sibling1]).name).toBe('Foo (copy) 2')
    expect(duplicateTemplate(source, [source, sibling1, sibling2]).name).toBe('Foo (copy) 3')
  })

  it('preserves an absent folder (root) by keeping it undefined', () => {
    const source = baseTemplate({ folder: undefined })
    const result = duplicateTemplate(source, [source])

    expect(result.folder).toBeUndefined()
  })
})

describe('findTabsInDeletedFolder', () => {
  it('matches templates directly inside the deleted folder', () => {
    const tabs = [makeTab('a', 'users'), makeTab('b', 'orders')]
    expect(findTabsInDeletedFolder(tabs, 'users')).toEqual(['a'])
  })

  it('matches templates in nested descendant folders', () => {
    const tabs = [
      makeTab('a', 'users'),
      makeTab('b', 'users/admin'),
      makeTab('c', 'users/admin/deep'),
      makeTab('d', 'orders'),
    ]
    expect(findTabsInDeletedFolder(tabs, 'users').sort()).toEqual(['a', 'b', 'c'])
  })

  it('does NOT match sibling folders that share a prefix (path boundary)', () => {
    // The boundary check (`startsWith(`${path}/`)`) is what stops
    // "users-extra" from being scooped up when deleting "users".
    const tabs = [makeTab('a', 'users'), makeTab('b', 'users-extra'), makeTab('c', 'usersbackup')]
    expect(findTabsInDeletedFolder(tabs, 'users')).toEqual(['a'])
  })

  it('does not match templates at root when a sub-folder is deleted', () => {
    const tabs = [makeTab('a', undefined), makeTab('b', 'users')]
    expect(findTabsInDeletedFolder(tabs, 'users')).toEqual(['b'])
  })

  it('returns an empty array when no tabs are inside the deleted folder', () => {
    const tabs = [makeTab('a', 'users'), makeTab('b', 'orders')]
    expect(findTabsInDeletedFolder(tabs, 'unknown')).toEqual([])
  })

  it('treats undefined folder as root and never scoops it on a sub-folder delete', () => {
    const tabs = [makeTab('a', undefined)]
    expect(findTabsInDeletedFolder(tabs, 'anything')).toEqual([])
  })
})
