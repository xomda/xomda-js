import type { Meta, StoryObj } from '@storybook/vue3'

import type { EntityData } from '../../types'
import { DiagramCanvas } from '../DiagramCanvas'
import { Entity } from './Entity'

const userEntity: EntityData = {
  id: 'user',
  name: 'User',
  attributes: [
    { id: 'id', name: 'id', type: 'uuid', required: true, primaryKey: true },
    { id: 'username', name: 'username', type: 'string', required: true, unique: true },
    { id: 'email', name: 'email', type: 'string', required: true, unique: true },
    { id: 'age', name: 'age', type: 'number' },
    { id: 'tags', name: 'tags', type: 'string', multiValue: true },
    { id: 'bio', name: 'bio', type: 'string', description: 'Short user biography' },
  ],
}

const meta: Meta<typeof Entity> = {
  component: Entity,
  title: 'Diagram/Entity',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    entity: { control: 'object' },
  },
}

export default meta
type Story = StoryObj<typeof Entity>

export const Default: Story = {
  args: { entity: userEntity },
}

export const WithHeaderAction: Story = {
  render: (args) => ({
    setup() {
      return () => (
        <Entity entity={args.entity}>
          {{
            'header-actions': ({ entity }: { entity: EntityData }) => (
              <button
                type="button"
                onClick={() => alert(`Add attribute to ${entity.name}`)}
                style="padding:2px 8px; font-size:12px"
              >
                +
              </button>
            ),
          }}
        </Entity>
      )
    },
  }),
  args: { entity: userEntity },
  parameters: {
    docs: {
      description: {
        story:
          'The `header-actions` slot lets the host render per-entity actions. The diagram itself is action-agnostic.',
      },
    },
  },
}

export const MinimalAttributes: Story = {
  args: {
    entity: {
      id: 'product',
      name: 'Product',
      attributes: [
        { id: 'id', name: 'id', type: 'number', primaryKey: true, required: true },
        { id: 'name', name: 'name', type: 'string', required: true },
        { id: 'price', name: 'price', type: 'decimal', required: true },
      ],
    },
  },
}

export const RichModel: Story = {
  args: {
    entity: {
      id: 'order',
      name: 'Order',
      attributes: [
        { id: 'id', name: 'id', type: 'uuid', primaryKey: true, required: true },
        { id: 'userId', name: 'userId', type: 'uuid', required: true },
        { id: 'status', name: 'status', type: 'OrderStatus', required: true },
        { id: 'items', name: 'items', type: 'OrderItem', multiValue: true, required: true },
        { id: 'total', name: 'total', type: 'decimal', required: true },
        { id: 'coupon', name: 'coupon', type: 'string' },
        { id: 'notes', name: 'notes', type: 'string', multiValue: true },
        { id: 'createdAt', name: 'createdAt', type: 'date', required: true },
        { id: 'updatedAt', name: 'updatedAt', type: 'date', required: true },
      ],
    },
  },
}

export const WithHeaderSlots: Story = {
  render: (args) => ({
    setup() {
      return () => (
        <Entity entity={args.entity}>
          {{
            'header-prefix': () => <span style="font-size:16px; opacity:0.9">⬡</span>,
            'header-suffix': () => (
              <span style="font-size:10px; background:rgba(255,255,255,0.2); padding:2px 6px; border-radius:4px; letter-spacing:0.05em">
                entity
              </span>
            ),
          }}
        </Entity>
      )
    },
  }),
  args: { entity: userEntity },
}

export const WithAttributeSlots: Story = {
  render: (args) => ({
    setup() {
      return () => (
        <Entity entity={args.entity}>
          {{
            'attribute-suffix': ({ attribute }: { attribute: { description?: string } }) =>
              attribute.description ? (
                <span
                  title={attribute.description}
                  style="padding:0 8px; opacity:0.4; cursor:help; font-size:12px; display:flex; align-items:center"
                >
                  ?
                </span>
              ) : (
                []
              ),
          }}
        </Entity>
      )
    },
  }),
  args: { entity: userEntity },
  parameters: {
    docs: {
      description: {
        story:
          'The `attribute-suffix` slot receives `{ attribute, index }` and renders a help icon for attributes that have a `description`.',
      },
    },
  },
}

export const InCanvas: Story = {
  render: () => ({
    setup() {
      const order: EntityData = {
        id: 'order',
        name: 'Order',
        attributes: [
          { id: 'id', name: 'id', type: 'uuid', primaryKey: true, required: true },
          { id: 'userId', name: 'userId', type: 'uuid', required: true },
          { id: 'total', name: 'total', type: 'decimal', required: true },
          { id: 'createdAt', name: 'createdAt', type: 'date', required: true },
        ],
      }
      return () => (
        <DiagramCanvas>
          {{
            default: () => [<Entity entity={userEntity} />, <Entity entity={order} />],
          }}
        </DiagramCanvas>
      )
    },
  }),
  parameters: { layout: 'fullscreen' },
}
