import { mount } from '@vue/test-utils'
import type { Entity, Model } from '@xomda/core'
import type { JsonValue } from 'type-fest'
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'

import { DynamicForm } from '../DynamicForm'

const vuetify = createVuetify()

const attributeEntity: Entity = {
  id: '50fc99cf-3510-4492-b8e4-18394e9450fa',
  name: 'Attribute',
  kind: 'default',
  attributes: [
    {
      id: 'a1',
      name: 'id',
      type: 'uuid',
      required: true,
      multiValue: false,
      primaryKey: true,
      unique: true,
    },
    {
      id: 'a2',
      name: 'name',
      type: 'string',
      required: true,
      multiValue: false,
      primaryKey: false,
      unique: false,
    },
    {
      id: 'a3',
      name: 'required',
      type: 'boolean',
      required: true,
      multiValue: false,
      primaryKey: false,
      unique: false,
    },
    {
      id: 'a4',
      name: 'multiValue',
      type: 'boolean',
      required: true,
      multiValue: false,
      primaryKey: false,
      unique: false,
    },
  ],
}

const baseModel: Model = {
  id: 'm1',
  name: 'Test',
  version: '1.0.0',
  packages: [
    {
      id: 'p1',
      name: 'p',
      packages: [],
      enums: [],
      entities: [attributeEntity],
    },
  ],
}

const mountForm = (props: Record<string, unknown>) =>
  mount(DynamicForm, {
    props: {
      entity: attributeEntity,
      modelValue: {},
      model: baseModel,
      ...props,
    },
    global: { plugins: [vuetify] },
  })

describe('DynamicForm', () => {
  it('renders a field per attribute, hiding the primaryKey field by default', () => {
    const wrapper = mountForm({
      modelValue: { id: 'x', name: 'foo', required: true, multiValue: false },
    })
    const text = wrapper.text()
    expect(text).toContain('Name')
    expect(text).toContain('Required')
    expect(text).toContain('Multi Value')
    // id has primaryKey: true → hidden
    expect(text).not.toContain('Id')
  })

  it('renders fields in the same order as entity.attributes', () => {
    // Reordered: name → multiValue → required (id hidden as primaryKey)
    const reorderedEntity: Entity = {
      ...attributeEntity,
      attributes: [
        attributeEntity.attributes[0], // id (hidden)
        attributeEntity.attributes[1], // name
        attributeEntity.attributes[3], // multiValue
        attributeEntity.attributes[2], // required
      ],
    }
    const wrapper = mountForm({
      entity: reorderedEntity,
      modelValue: { id: 'x', name: 'foo', required: true, multiValue: false },
    })
    const labels = wrapper.findAll('label').map((l) => l.text())
    const idxName = labels.findIndex((l) => l.includes('Name'))
    const idxMulti = labels.findIndex((l) => l.includes('Multi Value'))
    const idxRequired = labels.findIndex((l) => l.includes('Required'))
    expect(idxName).toBeLessThan(idxMulti)
    expect(idxMulti).toBeLessThan(idxRequired)
  })

  it('renders the primaryKey field when hidePrimaryKey is false', () => {
    const wrapper = mountForm({
      modelValue: { id: 'x', name: 'foo', required: true, multiValue: false },
      hidePrimaryKey: false,
    })
    expect(wrapper.text()).toContain('Id')
  })

  it('emits update:modelValue when a string field changes', async () => {
    const wrapper = mountForm({
      modelValue: { id: 'x', name: '', required: false, multiValue: false },
    })
    const nameInput = wrapper.find('input[type="text"]')
    await nameInput.setValue('hello')
    const events = wrapper.emitted('update:modelValue')
    expect(events).toBeTruthy()
    expect(events![0][0]).toMatchObject({ name: 'hello' })
  })

  it('does not emit a commit event (persistence is driven by parent Save buttons)', async () => {
    const wrapper = mountForm({
      modelValue: { id: 'x', name: 'foo', required: false, multiValue: false },
    })
    const nameInput = wrapper.find('input[type="text"]')
    await nameInput.trigger('blur')
    await nameInput.setValue('bar')
    expect(wrapper.emitted('commit')).toBeFalsy()
  })

  it('uses fieldOverrides when provided', () => {
    const wrapper = mountForm({
      modelValue: { id: 'x', name: 'foo', required: false, multiValue: false },
      fieldOverrides: {
        name: () => <div class="custom-name-override">CUSTOM</div>,
      },
    })
    expect(wrapper.find('.custom-name-override').exists()).toBe(true)
    expect(wrapper.text()).toContain('CUSTOM')
  })

  it('skips a field when its override returns null', () => {
    const wrapper = mountForm({
      modelValue: { id: 'x', name: 'foo', required: false, multiValue: false },
      fieldOverrides: {
        name: () => null,
      },
    })
    expect(wrapper.text()).not.toContain('Name')
    // Other fields still render
    expect(wrapper.text()).toContain('Required')
  })

  it('extends picker filters items to allowed parent kinds (default child → abstract parents only)', () => {
    const entityMetaEntity: Entity = {
      id: 'entity-meta',
      name: 'Entity',
      kind: 'default',
      attributes: [
        {
          id: 'p1',
          name: 'id',
          type: 'uuid',
          required: true,
          multiValue: false,
          primaryKey: true,
          unique: true,
        },
        {
          id: 'p2',
          name: 'extends',
          type: 'Entity',
          required: false,
          multiValue: false,
          primaryKey: false,
          unique: false,
          aggregation: 'none',
        },
      ],
    }
    const refModel: Model = {
      id: 'm',
      name: 'M',
      version: '1.0.0',
      packages: [
        {
          id: 'pkg',
          name: 'pkg',
          packages: [],
          enums: [],
          entities: [
            { id: 'a', name: 'AbstractBase', attributes: [], kind: 'abstract' },
            { id: 'd', name: 'DefaultEntity', attributes: [], kind: 'default' },
            { id: 'i', name: 'IFace', attributes: [], kind: 'interface' },
          ],
        },
      ],
    }
    const wrapper = mount(DynamicForm, {
      props: {
        entity: entityMetaEntity,
        // Child kind defaults to 'default' → parent must be 'abstract'.
        modelValue: { id: 'self', extends: null as unknown as JsonValue },
        model: refModel,
      },
      global: { plugins: [vuetify] },
    })
    const select = wrapper.findComponent({ name: 'VSelect' })
    const items = select.props('items') as { title: string; value: string }[]
    expect(items.map((i) => i.title)).toEqual(['AbstractBase'])
  })

  it('extends picker for an interface child filters to interface parents', () => {
    const entityMetaEntity: Entity = {
      id: 'entity-meta',
      name: 'Entity',
      kind: 'default',
      attributes: [
        {
          id: 'p1',
          name: 'id',
          type: 'uuid',
          required: true,
          multiValue: false,
          primaryKey: true,
          unique: true,
        },
        {
          id: 'p2',
          name: 'extends',
          type: 'Entity',
          required: false,
          multiValue: false,
          primaryKey: false,
          unique: false,
          aggregation: 'none',
        },
      ],
    }
    const refModel: Model = {
      id: 'm',
      name: 'M',
      version: '1.0.0',
      packages: [
        {
          id: 'pkg',
          name: 'pkg',
          packages: [],
          enums: [],
          entities: [
            { id: 'a', name: 'AbstractBase', attributes: [], kind: 'abstract' },
            { id: 'i1', name: 'IFaceA', attributes: [], kind: 'interface' },
            { id: 'i2', name: 'IFaceB', attributes: [], kind: 'interface' },
          ],
        },
      ],
    }
    const wrapper = mount(DynamicForm, {
      props: {
        entity: entityMetaEntity,
        modelValue: { id: 'self', kind: 'interface', extends: null as unknown as JsonValue },
        model: refModel,
      },
      global: { plugins: [vuetify] },
    })
    const select = wrapper.findComponent({ name: 'VSelect' })
    const items = select.props('items') as { title: string; value: string }[]
    expect(items.map((i) => i.title)).toEqual(['IFaceA', 'IFaceB'])
  })

  it('implements picker (multi-value) filters items to interface-kind only', () => {
    const entityMetaEntity: Entity = {
      id: 'entity-meta',
      name: 'Entity',
      kind: 'default',
      attributes: [
        {
          id: 'p1',
          name: 'id',
          type: 'uuid',
          required: true,
          multiValue: false,
          primaryKey: true,
          unique: true,
        },
        {
          id: 'p2',
          name: 'implements',
          type: 'Entity',
          required: false,
          multiValue: true,
          primaryKey: false,
          unique: false,
          aggregation: 'none',
        },
      ],
    }
    const refModel: Model = {
      id: 'm',
      name: 'M',
      version: '1.0.0',
      packages: [
        {
          id: 'pkg',
          name: 'pkg',
          packages: [],
          enums: [],
          entities: [
            { id: 'd', name: 'Concrete', attributes: [], kind: 'default' },
            { id: 'a', name: 'AbstractBase', attributes: [], kind: 'abstract' },
            { id: 'i1', name: 'IFaceA', attributes: [], kind: 'interface' },
            { id: 'i2', name: 'IFaceB', attributes: [], kind: 'interface' },
          ],
        },
      ],
    }
    const wrapper = mount(DynamicForm, {
      props: {
        entity: entityMetaEntity,
        modelValue: { id: 'self', implements: [] as unknown as JsonValue },
        model: refModel,
      },
      global: { plugins: [vuetify] },
    })
    const select = wrapper.findComponent({ name: 'VSelect' })
    const items = select.props('items') as { title: string; value: string }[]
    expect(items.map((i) => i.title)).toEqual(['IFaceA', 'IFaceB'])
    expect(select.props('multiple')).toBe(true)
  })

  it('multi-value reference attribute renders existing selections from modelValue', () => {
    const entityMetaEntity: Entity = {
      id: 'entity-meta',
      name: 'Entity',
      kind: 'default',
      attributes: [
        {
          id: 'p1',
          name: 'id',
          type: 'uuid',
          required: true,
          multiValue: false,
          primaryKey: true,
          unique: true,
        },
        {
          id: 'p2',
          name: 'implements',
          type: 'Entity',
          required: false,
          multiValue: true,
          primaryKey: false,
          unique: false,
          aggregation: 'none',
        },
      ],
    }
    const refModel: Model = {
      id: 'm',
      name: 'M',
      version: '1.0.0',
      packages: [
        {
          id: 'pkg',
          name: 'pkg',
          packages: [],
          enums: [],
          entities: [
            { id: 'i1', name: 'IFaceA', attributes: [], kind: 'interface' },
            { id: 'i2', name: 'IFaceB', attributes: [], kind: 'interface' },
          ],
        },
      ],
    }
    const wrapper = mount(DynamicForm, {
      props: {
        entity: entityMetaEntity,
        modelValue: { id: 'self', implements: ['i1', 'i2'] as unknown as JsonValue },
        model: refModel,
      },
      global: { plugins: [vuetify] },
    })
    const select = wrapper.findComponent({ name: 'VSelect' })
    expect(select.props('modelValue')).toEqual(['i1', 'i2'])
  })

  it('renders an Entity-typed reference attribute as a select of entities, excluding self', () => {
    // Mirrors the real case: editing an Entity instance whose Entity definition
    // has `extends: Entity, reference: true`. The picker should list other
    // Entity instances (i.e. other entity definitions in the model) and exclude
    // the entity being edited.
    const entityMetaEntity: Entity = {
      id: 'entity-meta',
      name: 'Entity',
      kind: 'default',
      attributes: [
        {
          id: 'p1',
          name: 'id',
          type: 'uuid',
          required: true,
          multiValue: false,
          primaryKey: true,
          unique: true,
        },
        {
          id: 'p2',
          name: 'extends',
          type: 'Entity',
          required: false,
          multiValue: false,
          primaryKey: false,
          unique: false,
          aggregation: 'none',
        },
      ],
    }
    const refModel: Model = {
      id: 'm',
      name: 'M',
      version: '1.0.0',
      packages: [
        {
          id: 'pkg',
          name: 'pkg',
          packages: [],
          enums: [],
          entities: [
            // `extends` targets must be `abstract` (or `interface` for an interface
            // child). The child is 'default', so candidate parents must be 'abstract'.
            { id: 'ent-a', name: 'A', attributes: [], kind: 'abstract' },
            { id: 'ent-b', name: 'B', attributes: [], kind: 'abstract' },
            // The instance currently being edited; should be excluded.
            { id: 'self', name: 'Self', attributes: [], kind: 'abstract' },
          ],
        },
      ],
    }
    const wrapper = mount(DynamicForm, {
      props: {
        entity: entityMetaEntity,
        modelValue: { id: 'self', extends: null as unknown as JsonValue },
        model: refModel,
      },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.text()).toContain('Extends')
    const select = wrapper.findComponent({ name: 'VSelect' })
    expect(select.exists()).toBe(true)
    const items = select.props('items') as { title: string; value: string }[]
    expect(items.map((i) => i.title)).toEqual(['A', 'B'])
    expect(items.find((i) => i.value === 'self')).toBeUndefined()
  })
})
