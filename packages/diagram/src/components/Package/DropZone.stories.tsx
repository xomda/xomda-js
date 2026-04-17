import type { Meta, StoryObj } from '@storybook/vue3'

import { DropZone } from './DropZone'

const meta: Meta<typeof DropZone> = {
  component: DropZone,
  title: 'Diagram/DropZone',
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof DropZone>

/**
 * `DropZone` is invisible until something is being dragged over it — drop
 * a draggable HTML element with `application/x-xomda-diagram` data to see
 * the indicator. In Storybook we wrap the zone in a tall container so the
 * 4 px slot is visible.
 */
const wrap = (children: () => unknown) => () => (
  <div
    style={{
      position: 'relative',
      width: '300px',
      height: '80px',
      background: 'rgba(var(--v-theme-surface), 0.5)',
      border: '1px dashed rgba(var(--v-theme-on-surface), 0.2)',
      padding: '16px',
    }}
  >
    {children()}
  </div>
)

export const FirstSlot: Story = {
  render: () => ({ setup: () => wrap(() => <DropZone index={0} />) }),
}

export const WithTargetPackage: Story = {
  render: () => ({
    setup: () => wrap(() => <DropZone index={2} targetPackageId="package-id" />),
  }),
}
