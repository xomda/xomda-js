import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { Attribute } from '../../../types'
import { EntityAttribute } from '../EntityAttribute'

const baseAttr: Attribute = {
  id: 'a1',
  name: 'author',
  type: 'Author',
  required: false,
  multiValue: false,
  primaryKey: false,
  unique: false,
}

describe('EntityAttribute — UML aggregation marker', () => {
  it('renders a filled diamond (◆) for composite aggregation', () => {
    const wrapper = mount(EntityAttribute, {
      props: { attribute: { ...baseAttr, aggregation: 'composite' } },
    })
    expect(wrapper.text()).toContain('◆')
    expect(wrapper.text()).not.toContain('◇')
    expect(wrapper.find('[class*="aggregationComposite"]').exists()).toBe(true)
  })

  it('renders an open diamond (◇) for plain association', () => {
    const wrapper = mount(EntityAttribute, {
      props: { attribute: { ...baseAttr, aggregation: 'none' } },
    })
    expect(wrapper.text()).toContain('◇')
    expect(wrapper.text()).not.toContain('◆')
    expect(wrapper.find('[class*="aggregationNone"]').exists()).toBe(true)
  })

  it('renders no diamond when aggregation is unset (primitive / enum types)', () => {
    const wrapper = mount(EntityAttribute, {
      props: { attribute: { ...baseAttr, type: 'string', aggregation: undefined } },
    })
    expect(wrapper.text()).not.toContain('◆')
    expect(wrapper.text()).not.toContain('◇')
    expect(wrapper.find('[class*="aggregation"]').exists()).toBe(false)
  })

  it('marks multivalued composite the same way (one-to-many is still composite)', () => {
    const wrapper = mount(EntityAttribute, {
      props: {
        attribute: {
          ...baseAttr,
          name: 'comments',
          type: 'Comment',
          multiValue: true,
          aggregation: 'composite',
        },
      },
    })
    expect(wrapper.text()).toContain('◆')
    // multiValue still annotates the type label with []
    expect(wrapper.find('[class*="multiValue"]').exists()).toBe(true)
  })
})
