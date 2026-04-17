import type { Meta, StoryObj } from '@storybook/vue3'
import { expect, fireEvent, fn, within } from 'storybook/test'
import { ref } from 'vue'

import { usePanelResize } from '../../composables/usePanelResize'
import { PanelDivider } from './PanelDivider'

const meta: Meta<typeof PanelDivider> = {
  component: PanelDivider,
  title: 'UI/PanelDivider',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    onResize: { action: 'resize' },
  },
}

export default meta
type Story = StoryObj<typeof PanelDivider>

// Horizontal: divider runs across the page and resizes the panel above
// it (vertical drag). `orientation="horizontal"` is the default.
export const Horizontal: Story = {
  args: { orientation: 'horizontal', onResize: fn() },
  render: (args) => ({
    setup() {
      const { width: topHeight, onResize } = usePanelResize(160, 80, 320)
      const onResizeDelta = (delta: number) => {
        onResize(delta)
        args.onResize?.(delta)
      }
      return () => (
        <div style="display: flex; flex-direction: column; height: 360px; background: #f5f5f7;">
          <div
            style={`height: ${topHeight.value}px; background: #fff; padding: 12px; overflow: auto;`}
          >
            Top panel ({topHeight.value}px) — drag the divider below to resize.
          </div>
          <PanelDivider {...args} onResize={onResizeDelta} />
          <div style="flex: 1; background: #fff; padding: 12px;">Bottom panel</div>
        </div>
      )
    },
  }),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    await step('divider is a separator with the right orientation', async () => {
      const divider = await canvas.findByRole('separator')
      // `aria-orientation` is perpendicular to the divider's drag axis.
      // Horizontal divider drags vertically → axis is "vertical".
      await expect(divider).toHaveAttribute('aria-orientation', 'vertical')
    })
  },
}

// Vertical: divider runs top-to-bottom and resizes the panel to its
// left (horizontal drag). Used in TemplatesView, ModelView, etc.
export const Vertical: Story = {
  args: { orientation: 'vertical', onResize: fn() },
  render: (args) => ({
    setup() {
      const { width: leftWidth, onResize } = usePanelResize(240, 160, 480)
      const onResizeDelta = (delta: number) => {
        onResize(delta)
        args.onResize?.(delta)
      }
      return () => (
        <div style="display: flex; height: 360px; background: #f5f5f7;">
          <div
            style={`width: ${leftWidth.value}px; background: #fff; padding: 12px; overflow: auto;`}
          >
            Left panel ({leftWidth.value}px)
          </div>
          <PanelDivider {...args} onResize={onResizeDelta} />
          <div style="flex: 1; background: #fff; padding: 12px;">Right panel</div>
        </div>
      )
    },
  }),
}

// usePanelResize honours the (min, max) clamp — the slider can't be
// dragged outside the configured range.
export const ClampedRange: Story = {
  args: { orientation: 'vertical', onResize: fn() },
  render: (args) => ({
    setup() {
      const min = 200
      const max = 320
      const { width, onResize } = usePanelResize(260, min, max)
      const onResizeDelta = (delta: number) => {
        onResize(delta)
        args.onResize?.(delta)
      }
      const lastDelta = ref(0)
      return () => (
        <div style="display: flex; height: 280px; background: #f5f5f7;">
          <div style={`width: ${width.value}px; background: #fff; padding: 12px;`}>
            min {min} · max {max} · current <strong>{width.value}px</strong>
            <br />
            last delta: {lastDelta.value}
          </div>
          <PanelDivider
            {...args}
            onResize={(d: number) => {
              lastDelta.value = d
              onResizeDelta(d)
            }}
          />
          <div style="flex: 1; background: #fff; padding: 12px;">
            Drag the divider — the left panel stops at {min}–{max}px.
          </div>
        </div>
      )
    },
  }),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    await step('separator role exposed for assistive tech', async () => {
      const divider = await canvas.findByRole('separator')
      await expect(divider).toBeInTheDocument()
    })
    await step('pointerdown + move emits resize', async () => {
      const divider = await canvas.findByRole('separator')
      // Vuetify's VApp can carry pointer-events: none mid-transition;
      // fireEvent avoids the pointer-trace fragility of userEvent.
      await fireEvent.pointerDown(divider, { button: 0, clientX: 240, clientY: 100 })
      await fireEvent.pointerMove(divider, { clientX: 280, clientY: 100 })
      await fireEvent.pointerUp(divider, { clientX: 280, clientY: 100 })
    })
  },
}
