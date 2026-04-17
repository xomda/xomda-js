import type { Template } from '@xomda/template'
import { describe, expect, it } from 'vitest'

import { useTemplateTabs } from '../useTemplateTabs'

function makeTemplate(uuid: string, name = `Tpl-${uuid}`): Template {
  return {
    uuid,
    name,
    version: '1.0.0',
    cells: [],
  }
}

const UUID_A = '00000000-0000-4000-a000-000000000001'
const UUID_B = '00000000-0000-4000-a000-000000000002'
const UUID_C = '00000000-0000-4000-a000-000000000003'

describe('useTemplateTabs', () => {
  it('starts empty with no active tab', () => {
    const t = useTemplateTabs()
    expect(t.tabs.value).toHaveLength(0)
    expect(t.activeUuid.value).toBeNull()
    expect(t.activeTab.value).toBeNull()
    expect(t.activeBuffer.value).toBeNull()
  })

  it('openTab adds a tab and focuses it', () => {
    const t = useTemplateTabs()
    t.openTab(makeTemplate(UUID_A))
    expect(t.tabs.value).toHaveLength(1)
    expect(t.tabs.value[0].uuid).toBe(UUID_A)
    expect(t.activeUuid.value).toBe(UUID_A)
    expect(t.activeBuffer.value?.draft.value?.name).toBe(`Tpl-${UUID_A}`)
  })

  it('openTab is idempotent for the same uuid (no duplicate tab)', () => {
    const t = useTemplateTabs()
    t.openTab(makeTemplate(UUID_A))
    t.openTab(makeTemplate(UUID_B))
    expect(t.tabs.value).toHaveLength(2)
    t.openTab(makeTemplate(UUID_A))
    expect(t.tabs.value).toHaveLength(2)
    expect(t.activeUuid.value).toBe(UUID_A)
  })

  it('openTab on a clean existing tab re-baselines from the incoming copy', () => {
    const t = useTemplateTabs()
    t.openTab(makeTemplate(UUID_A, 'first'))
    t.openTab(makeTemplate(UUID_A, 'renamed-server-side'))
    expect(t.activeBuffer.value?.draft.value?.name).toBe('renamed-server-side')
    expect(t.activeBuffer.value?.dirty.value).toBe(false)
  })

  it('openTab on a dirty existing tab preserves the draft (baseline-only update)', () => {
    const t = useTemplateTabs()
    t.openTab(makeTemplate(UUID_A, 'first'))
    if (t.activeBuffer.value?.draft.value) {
      t.activeBuffer.value.draft.value.name = 'user-edit'
    }
    expect(t.activeBuffer.value?.dirty.value).toBe(true)
    t.openTab(makeTemplate(UUID_A, 'server-rename'))
    expect(t.activeBuffer.value?.draft.value?.name).toBe('user-edit')
    expect(t.activeBuffer.value?.baseline.value?.name).toBe('server-rename')
    expect(t.activeBuffer.value?.dirty.value).toBe(true)
  })

  it('openTab on a second template switches active and keeps both tabs', () => {
    const t = useTemplateTabs()
    t.openTab(makeTemplate(UUID_A))
    t.openTab(makeTemplate(UUID_B))
    expect(t.tabs.value.map((x) => x.uuid)).toEqual([UUID_A, UUID_B])
    expect(t.activeUuid.value).toBe(UUID_B)
  })

  it('per-tab buffers are independent (edits in A do not affect B)', () => {
    const t = useTemplateTabs()
    t.openTab(makeTemplate(UUID_A, 'A'))
    t.openTab(makeTemplate(UUID_B, 'B'))
    // Switch back to A and edit
    t.openTab(makeTemplate(UUID_A, 'A'))
    if (t.activeBuffer.value?.draft.value) t.activeBuffer.value.draft.value.name = 'A-edited'
    const tabA = t.tabs.value.find((x) => x.uuid === UUID_A)!
    const tabB = t.tabs.value.find((x) => x.uuid === UUID_B)!
    expect(tabA.buffer.dirty.value).toBe(true)
    expect(tabB.buffer.dirty.value).toBe(false)
  })

  describe('removeTab active-fallback', () => {
    it('falls back to the next sibling', () => {
      const t = useTemplateTabs()
      t.openTab(makeTemplate(UUID_A))
      t.openTab(makeTemplate(UUID_B))
      t.openTab(makeTemplate(UUID_C))
      t.openTab(makeTemplate(UUID_B)) // focus middle
      expect(t.activeUuid.value).toBe(UUID_B)
      t.removeTab(UUID_B)
      expect(t.activeUuid.value).toBe(UUID_C)
    })

    it('falls back to the previous sibling when removed tab was last', () => {
      const t = useTemplateTabs()
      t.openTab(makeTemplate(UUID_A))
      t.openTab(makeTemplate(UUID_B))
      t.removeTab(UUID_B)
      expect(t.activeUuid.value).toBe(UUID_A)
    })

    it('falls back to null when the only tab is removed', () => {
      const t = useTemplateTabs()
      t.openTab(makeTemplate(UUID_A))
      t.removeTab(UUID_A)
      expect(t.activeUuid.value).toBeNull()
      expect(t.tabs.value).toHaveLength(0)
    })

    it('removing a non-active tab leaves activeUuid untouched', () => {
      const t = useTemplateTabs()
      t.openTab(makeTemplate(UUID_A))
      t.openTab(makeTemplate(UUID_B))
      t.openTab(makeTemplate(UUID_A)) // focus A
      t.removeTab(UUID_B)
      expect(t.activeUuid.value).toBe(UUID_A)
      expect(t.tabs.value.map((x) => x.uuid)).toEqual([UUID_A])
    })
  })

  describe('syncFromServer', () => {
    it('full-resets a clean tab', () => {
      const t = useTemplateTabs()
      t.openTab(makeTemplate(UUID_A, 'first'))
      t.syncFromServer(makeTemplate(UUID_A, 'server'))
      expect(t.activeBuffer.value?.draft.value?.name).toBe('server')
      expect(t.activeBuffer.value?.baseline.value?.name).toBe('server')
      expect(t.activeBuffer.value?.dirty.value).toBe(false)
    })

    it('baseline-only-updates a dirty tab', () => {
      const t = useTemplateTabs()
      t.openTab(makeTemplate(UUID_A, 'first'))
      if (t.activeBuffer.value?.draft.value) t.activeBuffer.value.draft.value.name = 'edit'
      t.syncFromServer(makeTemplate(UUID_A, 'server-rename'))
      expect(t.activeBuffer.value?.draft.value?.name).toBe('edit')
      expect(t.activeBuffer.value?.baseline.value?.name).toBe('server-rename')
      expect(t.activeBuffer.value?.dirty.value).toBe(true)
    })

    it('is a no-op when no matching tab is open', () => {
      const t = useTemplateTabs()
      t.openTab(makeTemplate(UUID_A))
      expect(() => t.syncFromServer(makeTemplate(UUID_B))).not.toThrow()
      expect(t.tabs.value).toHaveLength(1)
    })
  })

  describe('closeDeletedTemplate', () => {
    it('closes the matching tab and applies fallback', () => {
      const t = useTemplateTabs()
      t.openTab(makeTemplate(UUID_A))
      t.openTab(makeTemplate(UUID_B))
      t.closeDeletedTemplate(UUID_B)
      expect(t.tabs.value.map((x) => x.uuid)).toEqual([UUID_A])
      expect(t.activeUuid.value).toBe(UUID_A)
    })

    it('is a no-op when the uuid is not open', () => {
      const t = useTemplateTabs()
      t.openTab(makeTemplate(UUID_A))
      expect(() => t.closeDeletedTemplate(UUID_B)).not.toThrow()
      expect(t.tabs.value).toHaveLength(1)
    })
  })
})
