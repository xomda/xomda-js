import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components'

import { MenuButton } from '../MenuButton'

const vuetify = createVuetify()

const mountButton = (props: Record<string, unknown> = {}) =>
  mount(MenuButton, {
    props,
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })

describe('MenuButton', () => {
  it('renders icon-only when no label is supplied', () => {
    const wrapper = mountButton({ tooltip: 'More' })
    const btn = wrapper.findComponent(VBtn)
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('')
  })

  it('renders the label text on the button when label is set', () => {
    const wrapper = mountButton({ label: 'Model: Main Model' })
    expect(wrapper.text()).toContain('Model: Main Model')
  })

  it('uses the visible label as the accessible name when no aria-label is given', () => {
    const wrapper = mountButton({ label: 'Templates: root · primary' })
    const btn = wrapper.find('button')
    expect(btn.attributes('aria-label')).toBe('Templates: root · primary')
  })

  it('honours an explicit aria-label override when both are set', () => {
    const wrapper = mountButton({
      label: 'Visible label',
      ariaLabel: 'Accessible only',
    })
    const btn = wrapper.find('button')
    expect(btn.attributes('aria-label')).toBe('Accessible only')
  })

  it('passes a chevron append-icon to the labelled VBtn by default', () => {
    // Vuetify renders `appendIcon` as a class on the inner element; the
    // canonical detection is to check that the VBtn props include
    // `appendIcon` (regardless of how Vuetify normalises the icon value).
    const wrapper = mountButton({ label: 'X' })
    const btn = wrapper.findComponent(VBtn)
    expect(btn.props('appendIcon')).toBeTruthy()
  })

  it('forwards a custom appendIcon override', () => {
    const wrapper = mountButton({ label: 'X', appendIcon: 'mdi-custom' })
    const btn = wrapper.findComponent(VBtn)
    expect(btn.props('appendIcon')).toBe('mdi-custom')
  })

  it('icon-only buttons have NO appendIcon (unchanged contract)', () => {
    const wrapper = mountButton({ tooltip: 'More' })
    const btn = wrapper.findComponent(VBtn)
    expect(btn.props('appendIcon')).toBeFalsy()
  })

  it('disabled flows through to the button', () => {
    const wrapper = mountButton({ label: 'Closed', disabled: true })
    const btn = wrapper.findComponent(VBtn)
    expect(btn.props('disabled')).toBe(true)
  })
})
