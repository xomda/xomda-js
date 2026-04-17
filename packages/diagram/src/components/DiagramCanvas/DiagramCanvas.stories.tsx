import type { Meta, StoryObj } from '@storybook/vue3'
import type { EntityData, Layout } from '@xomda/core'

import { Entity } from '../Entity'
import { DiagramCanvas } from './DiagramCanvas'

const userEntity: EntityData = {
  id: 'user',
  name: 'User',
  attributes: [
    {
      id: 'id',
      name: 'id',
      type: 'UUID',
      required: true,
      primaryKey: true,
      unique: true,
      multiValue: false,
    },
    {
      id: 'email',
      name: 'email',
      type: 'string',
      required: true,
      unique: true,
      primaryKey: false,
      multiValue: false,
    },
    {
      id: 'name',
      name: 'name',
      type: 'string',
      required: true,
      primaryKey: false,
      unique: false,
      multiValue: false,
    },
  ],
}

const orderEntity: EntityData = {
  id: 'order',
  name: 'Order',
  attributes: [
    {
      id: 'o-id',
      name: 'id',
      type: 'UUID',
      required: true,
      primaryKey: true,
      unique: true,
      multiValue: false,
    },
    {
      id: 'o-total',
      name: 'total',
      type: 'decimal',
      required: true,
      primaryKey: false,
      unique: false,
      multiValue: false,
    },
  ],
}

const meta: Meta<typeof DiagramCanvas> = {
  component: DiagramCanvas,
  title: 'Diagram/DiagramCanvas',
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof DiagramCanvas>

export const Empty: Story = {
  render: () => ({
    setup: () => () => (
      <div style={{ width: '100%', height: '480px' }}>
        <DiagramCanvas layout={{} as Layout} />
      </div>
    ),
  }),
}

export const TwoEntities: Story = {
  render: () => ({
    setup() {
      const layout: Layout = {
        user: { x: 120, y: 80 },
        order: { x: 480, y: 200 },
      }
      return () => (
        <div style={{ width: '100%', height: '480px' }}>
          <DiagramCanvas layout={layout}>
            <Entity entity={userEntity} layout={layout.user} absolute />
            <Entity entity={orderEntity} layout={layout.order} absolute />
          </DiagramCanvas>
        </div>
      )
    },
  }),
}
