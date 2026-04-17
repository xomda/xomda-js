import { mount } from '@vue/test-utils'
import { SettingsIcon } from '@xomda/icons'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { SettingsNav, type SettingsNavItem } from '../SettingsNav'

const vuetify = createVuetify()

const items: SettingsNavItem[] = [
  { id: 'sandbox', label: 'File-system sandbox', icon: SettingsIcon },
  { id: 'diagram', label: 'Diagram', icon: SettingsIcon },
  { id: 'plugins', label: 'Plugins', icon: SettingsIcon },
]

describe('SettingsNav', () => {
  it('renders one button per section with the section label', () => {
    const onSelect = vi.fn()
    const wrapper = mount(SettingsNav, {
      props: { items, activeId: 'sandbox', onSelect },
      global: { plugins: [vuetify] },
    })

    const buttons = wrapper.findAll('button[role="tab"]')
    expect(buttons).toHaveLength(items.length)
    expect(buttons.map((b) => b.text())).toEqual(['File-system sandbox', 'Diagram', 'Plugins'])
  })

  it('marks the active item with aria-selected and a controls reference', () => {
    const wrapper = mount(SettingsNav, {
      props: { items, activeId: 'diagram', onSelect: vi.fn() },
      global: { plugins: [vuetify] },
    })

    const buttons = wrapper.findAll('button[role="tab"]')
    expect(buttons[0].attributes('aria-selected')).toBe('false')
    expect(buttons[1].attributes('aria-selected')).toBe('true')
    expect(buttons[1].attributes('aria-controls')).toBe('settings-section-diagram')
  })

  it('invokes onSelect with the section id when an item is clicked', async () => {
    const onSelect = vi.fn()
    const wrapper = mount(SettingsNav, {
      props: { items, activeId: 'sandbox', onSelect },
      global: { plugins: [vuetify] },
    })

    await wrapper.findAll('button[role="tab"]')[2].trigger('click')
    expect(onSelect).toHaveBeenCalledWith('plugins')
  })
})
