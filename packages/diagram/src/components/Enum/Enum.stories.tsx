import type { Meta, StoryObj } from '@storybook/vue3'

import type { EnumData } from '../../types'
import { Enum } from './Enum'

const statusEnum: EnumData = {
  id: 'status',
  name: 'OrderStatus',
  values: [
    { id: '1', name: 'PENDING' },
    { id: '2', name: 'PROCESSING' },
    { id: '3', name: 'SHIPPED' },
    { id: '4', name: 'DELIVERED' },
    { id: '5', name: 'CANCELLED' },
  ],
  description: 'Represents the current status of an order',
}

const meta: Meta<typeof Enum> = {
  component: Enum,
  title: 'Diagram/Enum',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    enum: { control: 'object' },
  },
}

export default meta
type Story = StoryObj<typeof Enum>

export const Default: Story = {
  args: { enum: statusEnum },
}

export const WithHeaderAction: Story = {
  render: (args) => ({
    setup() {
      return () => (
        <Enum enum={args.enum}>
          {{
            'header-actions': ({ enum: e }: { enum: EnumData }) => (
              <button
                type="button"
                onClick={() => alert(`Add value to ${e.name}`)}
                style="padding:2px 8px; font-size:12px"
              >
                +
              </button>
            ),
          }}
        </Enum>
      )
    },
  }),
  args: { enum: statusEnum },
  parameters: {
    docs: {
      description: {
        story:
          'The `header-actions` slot lets the host render per-enum actions. The diagram itself is action-agnostic.',
      },
    },
  },
}

export const Selected: Story = {
  args: { enum: statusEnum, selected: true },
}

export const ValueSelected: Story = {
  args: { enum: statusEnum, selectedValueId: '3' },
}
