import type { Meta, StoryObj } from '@storybook/vue3'

import { Collapsible } from './Collapsible'

const meta: Meta<typeof Collapsible> = {
  component: Collapsible,
  title: 'UI/Collapsible',
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof Collapsible>

export const Open: Story = {
  args: { label: 'Output', modelValue: true },
  render: (args) => ({
    setup() {
      return () => (
        <Collapsible {...args}>
          {{
            default: () => (
              <div class="pa-3 text-body-2">
                Collapsible body — open by default. Click the chevron to collapse.
              </div>
            ),
          }}
        </Collapsible>
      )
    },
  }),
}

export const Closed: Story = {
  args: { label: 'Output', modelValue: false },
  render: (args) => ({
    setup() {
      return () => (
        <Collapsible {...args}>
          {{
            default: () => <div class="pa-3 text-body-2">Hidden until expanded.</div>,
          }}
        </Collapsible>
      )
    },
  }),
}
