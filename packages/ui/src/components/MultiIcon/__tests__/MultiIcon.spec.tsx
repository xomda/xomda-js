import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'

import { MultiIcon } from '../MultiIcon'

const vuetify = createVuetify()
const mountIt = (props: Parameters<(typeof MultiIcon)['setup']>[0]) =>
  mount(MultiIcon, { props, global: { plugins: [vuetify] } })

const ICONS = {
  a: { icon: 'M0 0 L1 1', label: 'A' },
  b: { icon: 'M0 0 L2 2', label: 'B' },
  c: { icon: 'M0 0 L3 3', label: 'C' },
}

describe('MultiIcon', () => {
  it('renders nothing for an empty list', () => {
    const wrapper = mountIt({ icons: [] } as never)
    expect(wrapper.findAllComponents({ name: 'VIcon' })).toHaveLength(0)
  })

  it('renders one icon per entry, up to max', () => {
    const wrapper = mountIt({ icons: [ICONS.a, ICONS.b] } as never)
    expect(wrapper.findAllComponents({ name: 'VIcon' })).toHaveLength(2)
  })

  it('shows +N overflow when icons exceed max', () => {
    const wrapper = mountIt({
      icons: [ICONS.a, ICONS.b, ICONS.c, { icon: 'd' }, { icon: 'e' }],
      max: 3,
    } as never)
    expect(wrapper.findAllComponents({ name: 'VIcon' })).toHaveLength(3)
    expect(wrapper.text()).toContain('+2')
  })

  it('does not show overflow when icons fit exactly', () => {
    const wrapper = mountIt({ icons: [ICONS.a, ICONS.b], max: 2 } as never)
    expect(wrapper.text()).not.toContain('+')
  })

  it('combines all labels into the aria-label', () => {
    const wrapper = mountIt({ icons: [ICONS.a, ICONS.b] } as never)
    expect(wrapper.attributes('aria-label')).toBe('A, B')
  })
})
