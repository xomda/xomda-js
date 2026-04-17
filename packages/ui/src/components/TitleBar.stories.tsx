import type { Meta, StoryObj } from '@storybook/vue3'
import { AddIcon, SaveIcon } from '@xomda/icons'
import { VBtn } from 'vuetify/components'

import { TitleBar } from './TitleBar'

const meta: Meta<typeof TitleBar> = {
  component: TitleBar,
  title: 'UI/TitleBar',
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof TitleBar>

export const Default: Story = {
  render: () => ({
    setup() {
      return () => (
        <TitleBar>
          {{
            title: () => (
              <span>
                Model: ExampleModel <span class="text-caption">(v1.0)</span>
              </span>
            ),
            actions: () => (
              <>
                <VBtn prepend-icon={AddIcon} variant="tonal" color="primary">
                  Add package
                </VBtn>
                <VBtn prepend-icon={SaveIcon} variant="tonal" color="primary">
                  Publish version
                </VBtn>
              </>
            ),
          }}
        </TitleBar>
      )
    },
  }),
}

export const TitleOnly: Story = {
  render: () => ({
    setup() {
      return () => (
        <TitleBar>
          {{
            title: () => <span>Versions</span>,
          }}
        </TitleBar>
      )
    },
  }),
}
