import { mount } from '@vue/test-utils'
import type { ModelDiff } from '@xomda/core'
import { emptyModelDiff } from '@xomda/core'
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'

import { ModelDiffView } from '../ModelDiffView'

const vuetify = createVuetify()

const mountWith = (diff: ModelDiff) =>
  mount(ModelDiffView, { props: { diff }, global: { plugins: [vuetify] } })

describe('ModelDiffView', () => {
  it('renders the empty state when the diff has no changes', () => {
    const wrapper = mountWith(emptyModelDiff())
    expect(wrapper.text()).toContain('No differences')
  })

  it('renders added entities under the Added section', () => {
    const diff = emptyModelDiff()
    diff.added.entities.push({
      entity: { id: 'e-1', name: 'Order', attributes: [] },
      packageId: 'p-1',
      packageName: 'com.example',
    })
    const wrapper = mountWith(diff)
    expect(wrapper.text().toLowerCase()).toContain('added')
    expect(wrapper.text()).toContain('Order')
    expect(wrapper.text()).toContain('com.example')
  })

  it('renders renamed attributes with the old → new arrow', () => {
    const diff = emptyModelDiff()
    diff.renamed.attributes.push({
      id: 'a-1',
      oldName: 'email',
      newName: 'emailAddress',
      entityId: 'e-1',
      entityName: 'User',
    })
    const wrapper = mountWith(diff)
    expect(wrapper.text()).toContain('email')
    expect(wrapper.text()).toContain('emailAddress')
    expect(wrapper.text()).toContain('→')
  })

  it('renders modified attributes with their changes list', () => {
    const diff = emptyModelDiff()
    diff.modified.attributes.push({
      id: 'a-1',
      before: {
        id: 'a-1',
        name: 'age',
        type: 'string',
        required: false,
        multiValue: false,
        primaryKey: false,
        unique: false,
      },
      after: {
        id: 'a-1',
        name: 'age',
        type: 'number',
        required: true,
        multiValue: false,
        primaryKey: false,
        unique: false,
      },
      changes: ['type', 'required'],
      entityId: 'e-1',
      entityName: 'User',
    })
    const wrapper = mountWith(diff)
    expect(wrapper.text()).toContain('User.age')
    expect(wrapper.text()).toContain('type')
    expect(wrapper.text()).toContain('required')
  })

  it('surfaces loose extension changes', () => {
    const diff = emptyModelDiff()
    diff.loose.push({
      kind: 'attribute',
      id: 'a-1',
      before: {},
      after: { customLength: 255 },
    })
    const wrapper = mountWith(diff)
    expect(wrapper.text()).toContain('Extension fields changed')
    expect(wrapper.text()).toContain('attribute')
    expect(wrapper.text()).toContain('customLength')
  })
})
