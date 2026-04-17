import type { Meta, StoryObj } from '@storybook/vue3'
import { InfoIcon, RefreshIcon } from '@xomda/icons'
import { expect, fireEvent, fn, within } from 'storybook/test'
import { VBtn, VTooltip } from 'vuetify/components'

import { SidePanel } from './SidePanel'

const meta: Meta<typeof SidePanel> = {
  component: SidePanel,
  title: 'UI/SidePanel',
  parameters: { layout: 'padded' },
  argTypes: {
    onClose: { action: 'close' },
  },
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
  args: { title: 'File Information', icon: InfoIcon, width: 320, onClose: fn() },
  render: (args) => ({
    setup() {
      return () => (
        <SidePanel {...args}>
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
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // The close button carries aria-label "Close" — direct lookup is more
    // robust than walking through the VTooltip activator.
    const closeBtn = canvas.getByLabelText('Close')
    await fireEvent.click(closeBtn)
    await expect(args.onClose).toHaveBeenCalledTimes(1)
  },
}

export const WithHeaderActions: Story = {
  args: { title: 'Properties', icon: InfoIcon, width: 320, onClose: fn() },
  render: (args) => ({
    setup() {
      return () => (
        <SidePanel {...args}>
          {{
            default: () => <div>Body content goes here.</div>,
            headerActions: () => (
              <VTooltip text="Reload" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={RefreshIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Reload"
                    />
                  ),
                }}
              </VTooltip>
            ),
          }}
        </SidePanel>
      )
    },
  }),
}

// Cranking the CSS variable to extremes makes the translucency-tracking
// contract visible at a glance. The fallback in the SCSS keeps this
// observable in Storybook even though the running app's App.tsx watcher
// (which projects `cardSurfaceAlpha` from useLocalStorageStore) is absent.
const renderAtAlpha = (alpha: number) => ({
  setup() {
    return () => (
      <div style={{ '--xomda-card-bg-alpha': String(alpha) } as Record<string, string>}>
        <SidePanel title="Properties" icon={InfoIcon} width={320} onClose={fn()}>
          {{ default: () => <div>Header and footer share this surface.</div> }}
        </SidePanel>
      </div>
    )
  },
})

export const Translucent: Story = {
  name: 'Translucent (alpha 0.2)',
  render: () => renderAtAlpha(0.2),
}

export const FullyOpaque: Story = {
  name: 'Fully opaque (alpha 1.0)',
  render: () => renderAtAlpha(1),
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
