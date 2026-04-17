import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createVuetify } from 'vuetify'

import { useThemeMode } from '../useThemeMode'

function makeHost(modeFn: () => 'light' | 'dark' | 'auto' | undefined) {
  return defineComponent({
    setup() {
      const isDark = useThemeMode(modeFn)
      return () => h('span', { 'data-dark': String(isDark.value) })
    },
  })
}

describe('useThemeMode', () => {
  it('returns true when mode=dark', () => {
    const wrapper = mount(makeHost(() => 'dark'))
    expect(wrapper.attributes('data-dark')).toBe('true')
  })

  it('returns false when mode=light', () => {
    const wrapper = mount(makeHost(() => 'light'))
    expect(wrapper.attributes('data-dark')).toBe('false')
  })

  it('falls back to false in auto mode without Vuetify', () => {
    const wrapper = mount(makeHost(() => 'auto'))
    expect(wrapper.attributes('data-dark')).toBe('false')
  })

  it('uses Vuetify dark flag in auto mode when available', () => {
    const vuetify = createVuetify({ theme: { defaultTheme: 'dark' } })
    const wrapper = mount(
      makeHost(() => 'auto'),
      { global: { plugins: [vuetify] } }
    )
    expect(wrapper.attributes('data-dark')).toBe('true')
  })
})
