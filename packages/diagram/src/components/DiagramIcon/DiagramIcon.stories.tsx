import type { Meta, StoryObj } from '@storybook/vue3'

import { DiagramIcon } from './DiagramIcon'

const meta: Meta<typeof DiagramIcon> = {
  component: DiagramIcon,
  title: 'Diagram/DiagramIcon',
}

export default meta
type Story = StoryObj<typeof DiagramIcon>

// A simple "M…" path so the story is self-contained — DiagramIcon takes raw SVG path data.
const dotPath = 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z'
const trianglePath = 'M12 4 4 18h16Z'

export const Default: Story = {
  render: () => ({ setup: () => () => <DiagramIcon icon={dotPath} /> }),
}

export const Triangle: Story = {
  render: () => ({ setup: () => () => <DiagramIcon icon={trianglePath} /> }),
}

export const Large: Story = {
  render: () => ({ setup: () => () => <DiagramIcon icon={dotPath} size={64} /> }),
}
