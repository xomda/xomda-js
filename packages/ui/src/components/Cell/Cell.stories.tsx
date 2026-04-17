import type { Meta, StoryObj } from '@storybook/vue3'

import { Cell } from './Cell'

const meta: Meta<typeof Cell> = {
  component: Cell,
  title: 'UI/Cell',
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof Cell>

export const Basic: Story = {
  render: (args) => ({
    setup() {
      return () => (
        <Cell {...args}>
          {{
            default: () => (
              <div class="pa-4 text-body-2">Cell body — drop any editor or content slot here.</div>
            ),
          }}
        </Cell>
      )
    },
  }),
}

export const WithTypeOptions: Story = {
  args: {
    typeOptions: [
      { key: 'logic', title: 'JavaScript', active: true },
      { key: 'markdown', title: 'Markdown' },
      { key: 'handlebars', title: 'Handlebars' },
      { key: 'output', title: 'Output' },
    ],
  },
  render: (args) => ({
    setup() {
      return () => (
        <Cell {...args}>
          {{
            default: () => (
              <pre class="pa-4 mb-0" style="font-family:monospace;font-size:12px">
                {`function* provide(model) {\n  for (const e of model.entities) yield e\n}`}
              </pre>
            ),
          }}
        </Cell>
      )
    },
  }),
}

export const FirstAndLast: Story = {
  name: 'First/last (move buttons disabled)',
  args: {
    disableMoveUp: true,
    disableMoveDown: true,
    typeOptions: [{ key: 'logic', title: 'JavaScript', active: true }],
  },
  render: (args) => ({
    setup() {
      return () => (
        <Cell {...args}>
          {{
            default: () => <div class="pa-4 text-body-2">Only cell in the template.</div>,
          }}
        </Cell>
      )
    },
  }),
}
