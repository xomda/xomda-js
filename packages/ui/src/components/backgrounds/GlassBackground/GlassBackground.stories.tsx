import type { Meta, StoryObj } from '@storybook/vue3'

import { GlassBackground } from './GlassBackground'

const meta: Meta<typeof GlassBackground> = {
  component: GlassBackground,
  title: 'UI/backgrounds/GlassBackground',
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof GlassBackground>

const wrap = (children: () => unknown) => () => (
  <div style={{ position: 'relative', width: '100%', height: '480px', overflow: 'hidden' }}>
    {children()}
  </div>
)

export const Default: Story = {
  render: () => ({ setup: () => wrap(() => <GlassBackground />) }),
}

export const HighIntensity: Story = {
  render: () => ({ setup: () => wrap(() => <GlassBackground intensity={0.6} />) }),
}

export const Dense: Story = {
  render: () => ({ setup: () => wrap(() => <GlassBackground density={0.9} intensity={0.4} />) }),
}

export const SlowAnimation: Story = {
  render: () => ({ setup: () => wrap(() => <GlassBackground animationSpeed={0.3} />) }),
}

export const Paused: Story = {
  render: () => ({ setup: () => wrap(() => <GlassBackground paused />) }),
}

export const Blurred: Story = {
  render: () => ({ setup: () => wrap(() => <GlassBackground blur={20} />) }),
}
