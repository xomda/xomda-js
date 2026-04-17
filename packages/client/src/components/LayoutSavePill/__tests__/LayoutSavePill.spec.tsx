import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { LayoutSavePill } from '../LayoutSavePill'

const vuetify = createVuetify()

const mountPill = (props: Record<string, unknown> = {}) =>
  mount(LayoutSavePill, { props, global: { plugins: [createPinia(), vuetify] } })

describe('LayoutSavePill', () => {
  it('renders nothing when not dirty', () => {
    const w = mountPill({ dirty: false })
    expect(w.find('[role="region"]').exists()).toBe(false)
  })

  it('renders Save and Cancel buttons when dirty', () => {
    const w = mountPill({ dirty: true })
    expect(w.find('[aria-label="Save layout"]').exists()).toBe(true)
    expect(w.find('[aria-label="Cancel layout changes"]').exists()).toBe(true)
  })

  it('clicking Save invokes onSave', async () => {
    const onSave = vi.fn()
    const w = mountPill({ dirty: true, onSave })
    await w.find('[aria-label="Save layout"]').trigger('click')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('clicking Cancel invokes onCancel', async () => {
    const onCancel = vi.fn()
    const w = mountPill({ dirty: true, onCancel })
    await w.find('[aria-label="Cancel layout changes"]').trigger('click')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
