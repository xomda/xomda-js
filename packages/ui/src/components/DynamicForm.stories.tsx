import type { Meta, StoryObj } from '@storybook/vue3'
import type { Entity, Model } from '@xomda/core'
import type { JsonObject } from 'type-fest'
import { ref } from 'vue'

import { DynamicForm } from './DynamicForm'

const meta: Meta<typeof DynamicForm> = {
  component: DynamicForm,
  title: 'UI/DynamicForm',
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof DynamicForm>

/** A minimal Entity definition used to drive the form fields. The shape
 *  mirrors how `.xomda/model.json` describes Entity / Enum / Package. */
const customerEntity: Entity = {
  id: 'ent-customer',
  name: 'Customer',
  attributes: [
    {
      id: 'a-id',
      name: 'id',
      type: 'UUID',
      primaryKey: true,
      required: true,
      multiValue: false,
      unique: true,
    },
    {
      id: 'a-name',
      name: 'name',
      type: 'string',
      primaryKey: false,
      required: true,
      multiValue: false,
      unique: false,
    },
    {
      id: 'a-active',
      name: 'isActive',
      type: 'boolean',
      primaryKey: false,
      required: false,
      multiValue: false,
      unique: false,
    },
    {
      id: 'a-credit',
      name: 'creditLimit',
      type: 'number',
      primaryKey: false,
      required: false,
      multiValue: false,
      unique: false,
    },
  ],
}

const emptyModel: Model = {
  id: 'm',
  name: 'Demo',
  version: '1.0.0',
  packages: [],
}

export const Default: Story = {
  render: () => ({
    setup() {
      const data = ref<JsonObject>({ name: 'Acme Corp', isActive: true, creditLimit: 5000 })
      return () => (
        <DynamicForm
          entity={customerEntity}
          model={emptyModel}
          modelValue={data.value}
          onUpdate:modelValue={(v: JsonObject) => (data.value = v)}
        />
      )
    },
  }),
}

export const Empty: Story = {
  render: () => ({
    setup() {
      const data = ref<JsonObject>({})
      return () => (
        <DynamicForm
          entity={customerEntity}
          model={emptyModel}
          modelValue={data.value}
          onUpdate:modelValue={(v: JsonObject) => (data.value = v)}
        />
      )
    },
  }),
}

export const ShowingPrimaryKey: Story = {
  render: () => ({
    setup() {
      const data = ref<JsonObject>({ id: 'b3e7…', name: 'Acme Corp' })
      return () => (
        <DynamicForm
          entity={customerEntity}
          model={emptyModel}
          modelValue={data.value}
          hidePrimaryKey={false}
          onUpdate:modelValue={(v: JsonObject) => (data.value = v)}
        />
      )
    },
  }),
}
