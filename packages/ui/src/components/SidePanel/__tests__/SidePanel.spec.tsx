import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { SidePanel } from '../SidePanel'

const vuetify = createVuetify()

const mountPanel = (
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {}
) =>
  mount(SidePanel, {
    props: { title: 'Properties', ...props },
    slots,
    attachTo: document.body,
    global: { plugins: [vuetify] },
  })

describe('SidePanel', () => {
  it('renders the title', () => {
    const wrapper = mountPanel()
    expect(wrapper.text()).toContain('Properties')
  })

  it('renders default-slot body content', () => {
    const wrapper = mountPanel({}, { default: () => <div class="panel-body">body</div> })
    expect(wrapper.find('.panel-body').exists()).toBe(true)
  })

  it('does not render close button when onClose is not provided', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[aria-label="Close"]').exists()).toBe(false)
  })

  it('renders close button and fires onClose when clicked', async () => {
    const onClose = vi.fn()
    const wrapper = mountPanel({ onClose })
    await wrapper.find('[aria-label="Close"]').trigger('click')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders headerActions slot before the close button', () => {
    const wrapper = mountPanel(
      { onClose: () => {} },
      { headerActions: () => <button class="extra-action">Extra</button> }
    )
    expect(wrapper.find('.extra-action').exists()).toBe(true)
  })

  it('renders footer slot when provided', () => {
    const wrapper = mountPanel({}, { footer: () => <div class="panel-footer">footer</div> })
    expect(wrapper.find('.panel-footer').exists()).toBe(true)
  })

  it('does not render footer when no footer slot is provided', () => {
    const wrapper = mountPanel({}, { default: () => 'body' })
    // No footer slot => no footer container in DOM
    expect(wrapper.html()).not.toContain('panel-footer')
  })
})
