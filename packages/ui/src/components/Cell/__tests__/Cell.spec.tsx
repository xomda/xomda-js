import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'

import type { MenuItemConfig } from '../../Menu'
import { Cell } from '../Cell'

const vuetify = createVuetify()

const mountCell = (
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {}
) =>
  mount(Cell, {
    props,
    slots,
    attachTo: document.body,
    global: { plugins: [vuetify] },
  })

describe('Cell', () => {
  it('renders default-slot body content', () => {
    const wrapper = mountCell({}, { default: () => <div class="cell-body">body content</div> })
    expect(wrapper.text()).toContain('body content')
  })

  it('does not render any chip in the gutter', () => {
    const wrapper = mountCell()
    expect(wrapper.find('.v-chip').exists()).toBe(false)
  })

  it('emits addAbove when the add-above button is clicked', async () => {
    const wrapper = mountCell()
    await wrapper.find('[aria-label="Add cell above"]').trigger('click')
    expect(wrapper.emitted('addAbove')).toHaveLength(1)
  })

  it('emits addBelow when the add-below button is clicked', async () => {
    const wrapper = mountCell()
    await wrapper.find('[aria-label="Add cell below"]').trigger('click')
    expect(wrapper.emitted('addBelow')).toHaveLength(1)
  })

  it('renders the toolbar slot when provided', () => {
    const wrapper = mountCell({}, { toolbar: () => <div class="custom-toolbar">toolbar slot</div> })
    expect(wrapper.find('.custom-toolbar').exists()).toBe(true)
    expect(wrapper.text()).toContain('toolbar slot')
  })

  it('accepts typeOptions without throwing', () => {
    const typeOptions: MenuItemConfig[] = [
      { key: 'a', title: 'Option A', active: true },
      { key: 'b', title: 'Option B' },
    ]
    expect(() => mountCell({ typeOptions })).not.toThrow()
  })
})
