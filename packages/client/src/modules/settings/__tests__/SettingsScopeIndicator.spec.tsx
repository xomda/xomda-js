import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'

import { SettingsScopeIndicator } from '../SettingsScopeIndicator'

const vuetify = createVuetify()

describe('SettingsScopeIndicator', () => {
  it('renders a project-scope marker with a descriptive aria label', () => {
    const wrapper = mount(SettingsScopeIndicator, {
      props: { scope: 'project' },
      global: { plugins: [vuetify] },
    })
    const marker = wrapper.find('[data-testid="settings-scope-project"]')
    expect(marker.exists()).toBe(true)
    expect(marker.attributes('aria-label')).toBe('Project setting')
  })

  it('renders a local-scope marker with a descriptive aria label', () => {
    const wrapper = mount(SettingsScopeIndicator, {
      props: { scope: 'local' },
      global: { plugins: [vuetify] },
    })
    const marker = wrapper.find('[data-testid="settings-scope-local"]')
    expect(marker.exists()).toBe(true)
    expect(marker.attributes('aria-label')).toBe('Local setting')
  })
})
