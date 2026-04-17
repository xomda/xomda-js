import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'

import { PluginIcon } from '../../PluginIcon'
import { MultiIcon } from '../MultiIcon'

const vuetify = createVuetify()
const mountIt = (props: InstanceType<typeof MultiIcon>['$props']) =>
  mount(MultiIcon, { props, global: { plugins: [vuetify] } })

// Mix the two `@xomda/icons` shapes so we exercise PluginIcon's discriminator:
// `<svg…` → SvgIcon path; `'M…'` → VIcon path.
const ICONS = {
  a: {
    icon: '<svg viewBox="0 0 128 128"><path fill="#007ACC" d="M0 0h128v128H0z"/></svg>',
    label: 'A',
  },
  b: { icon: 'M12 2L2 22h20L12 2z', label: 'B' },
  c: {
    icon: '<svg viewBox="0 0 128 128"><path fill="#3C873A" d="M0 0h128v128H0z"/></svg>',
    label: 'C',
  },
}

describe('MultiIcon', () => {
  it('renders nothing for an empty list', () => {
    const wrapper = mountIt({ icons: [] })
    expect(wrapper.findAllComponents(PluginIcon)).toHaveLength(0)
  })

  it('renders one icon per entry, up to max', () => {
    const wrapper = mountIt({ icons: [ICONS.a, ICONS.b] })
    expect(wrapper.findAllComponents(PluginIcon)).toHaveLength(2)
  })

  it('shows +N overflow when icons exceed max', () => {
    const wrapper = mountIt({
      icons: [ICONS.a, ICONS.b, ICONS.c, { icon: 'M0 0L1 1' }, { icon: 'M2 2L3 3' }],
      max: 3,
    })
    expect(wrapper.findAllComponents(PluginIcon)).toHaveLength(3)
    expect(wrapper.text()).toContain('+2')
  })

  it('does not show overflow when icons fit exactly', () => {
    const wrapper = mountIt({ icons: [ICONS.a, ICONS.b], max: 2 })
    expect(wrapper.text()).not.toContain('+')
  })

  it('combines all labels into the aria-label', () => {
    const wrapper = mountIt({ icons: [ICONS.a, ICONS.b] })
    expect(wrapper.attributes('aria-label')).toBe('A, B')
  })
})
