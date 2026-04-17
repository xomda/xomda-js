import type { Meta, StoryObj } from '@storybook/vue3'
import { InfoIcon } from '@xomda/icons'
import { VBtn } from 'vuetify/components'

import { SidePanel } from './SidePanel'

const meta: Meta<typeof SidePanel> = {
  component: SidePanel,
  title: 'UI/SidePanel',
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof SidePanel>

export const Basic: Story = {
  args: { title: 'Properties', width: 320 },
  render: (args) => ({
    setup() {
      return () => (
        <SidePanel {...args} onClose={() => console.log('close')}>
          {{
            default: () => <div>Body content goes here.</div>,
          }}
        </SidePanel>
      )
    },
  }),
}

export const WithIconAndFooter: Story = {
  args: { title: 'File Information', icon: InfoIcon, width: 320 },
  render: (args) => ({
    setup() {
      return () => (
        <SidePanel {...args} onClose={() => console.log('close')}>
          {{
            default: () => <div>Detailed info...</div>,
            footer: () => (
              <>
                <VBtn variant="text">Cancel</VBtn>
                <VBtn variant="tonal" color="primary">
                  Save
                </VBtn>
              </>
            ),
          }}
        </SidePanel>
      )
    },
  }),
}

export const WithoutCloseButton: Story = {
  args: { title: 'Always Visible', width: 320 },
  render: (args) => ({
    setup() {
      return () => (
        <SidePanel {...args}>
          {{
            default: () => <div>This panel has no close button.</div>,
          }}
        </SidePanel>
      )
    },
  }),
}
