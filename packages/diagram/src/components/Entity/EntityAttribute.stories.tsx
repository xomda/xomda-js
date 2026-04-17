import type { Meta, StoryObj } from '@storybook/vue3'
import type { Attribute } from '@xomda/core'

import { EntityAttribute } from './EntityAttribute'

const meta: Meta<typeof EntityAttribute> = {
  component: EntityAttribute,
  title: 'Diagram/EntityAttribute',
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof EntityAttribute>

const base: Omit<Attribute, 'name'> = {
  id: 'a1',
  type: 'string',
  required: false,
  multiValue: false,
  primaryKey: false,
  unique: false,
}

export const Default: Story = {
  render: () => ({
    setup: () => () => <EntityAttribute attribute={{ ...base, name: 'email' }} />,
  }),
}

export const PrimaryKey: Story = {
  render: () => ({
    setup: () => () => (
      <EntityAttribute
        attribute={{ ...base, name: 'id', primaryKey: true, required: true, type: 'uuid' }}
      />
    ),
  }),
}

export const Required: Story = {
  render: () => ({
    setup: () => () => (
      <EntityAttribute attribute={{ ...base, name: 'createdAt', type: 'date', required: true }} />
    ),
  }),
}

export const Unique: Story = {
  render: () => ({
    setup: () => () => (
      <EntityAttribute attribute={{ ...base, name: 'slug', unique: true, required: true }} />
    ),
  }),
}

export const Inherited: Story = {
  render: () => ({
    setup: () => () => (
      <EntityAttribute attribute={{ ...base, name: 'tenant_id', type: 'uuid' }} inherited />
    ),
  }),
}

export const Selected: Story = {
  render: () => ({
    setup: () => () => <EntityAttribute attribute={{ ...base, name: 'name' }} selected />,
  }),
}

export const MultiValue: Story = {
  render: () => ({
    setup: () => () => <EntityAttribute attribute={{ ...base, name: 'tags', multiValue: true }} />,
  }),
}
