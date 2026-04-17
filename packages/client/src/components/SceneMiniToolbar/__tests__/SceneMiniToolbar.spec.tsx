import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { SceneMiniToolbar } from '../SceneMiniToolbar'

const vuetify = createVuetify()

const mountToolbar = (props: Record<string, unknown> = {}) =>
  mount(SceneMiniToolbar, { props, global: { plugins: [createPinia(), vuetify] } })

describe('SceneMiniToolbar', () => {
  it('renders the Select / Drag-scene toggle and Scene label', () => {
    const w = mountToolbar({ mode: 'items' })
    expect(w.find('[aria-label="Select tool"]').exists()).toBe(true)
    expect(w.find('[aria-label="Drag scene mode"]').exists()).toBe(true)
    expect(w.text()).toContain('Scene')
  })

  it('clicking the Drag-scene button fires onModeChange with "pan"', async () => {
    const onModeChange = vi.fn()
    const w = mountToolbar({ mode: 'items', onModeChange })
    await w.find('[aria-label="Drag scene mode"]').trigger('click')
    expect(onModeChange).toHaveBeenCalledWith('pan')
  })

  it('renders the Reset zero point button only when onResetZeroPoint is wired', () => {
    const wWith = mountToolbar({ mode: 'items', onResetZeroPoint: vi.fn() })
    expect(wWith.find('[aria-label="Reset zero point"]').exists()).toBe(true)
    const wWithout = mountToolbar({ mode: 'items' })
    expect(wWithout.find('[aria-label="Reset zero point"]').exists()).toBe(false)
  })

  it('clicking Reset zero point invokes the handler', async () => {
    const onResetZeroPoint = vi.fn()
    const w = mountToolbar({ mode: 'items', onResetZeroPoint })
    await w.find('[aria-label="Reset zero point"]').trigger('click')
    expect(onResetZeroPoint).toHaveBeenCalledTimes(1)
  })

  it('Close button only renders when onClose is wired', async () => {
    const onClose = vi.fn()
    const w = mountToolbar({ mode: 'items', onClose })
    const btn = w.find('[aria-label="Close scene toolbar"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('positions itself at the given anchor', () => {
    const w = mountToolbar({ mode: 'items', anchor: { top: 64, left: 128 } })
    const style = w.find('[role="toolbar"]').attributes('style') ?? ''
    expect(style).toContain('top: 64px')
    expect(style).toContain('left: 128px')
  })
})
