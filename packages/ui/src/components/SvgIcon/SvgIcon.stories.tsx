import type { Meta, StoryObj } from '@storybook/vue3'
import { PluginMavenIcon, PluginRustIcon, PluginTypeScriptIcon } from '@xomda/icons'

import { SvgIcon } from './SvgIcon'

const meta: Meta<typeof SvgIcon> = {
  component: SvgIcon,
  title: 'UI/SvgIcon',
  argTypes: {
    svg: { control: 'text' },
    size: { control: { type: 'number', min: 12, max: 256, step: 4 } },
  },
}

export default meta
type Story = StoryObj<typeof SvgIcon>

export const TypeScript: Story = {
  args: { svg: PluginTypeScriptIcon, size: 48, label: 'TypeScript' },
}

export const Maven: Story = {
  args: { svg: PluginMavenIcon, size: 48, label: 'Maven' },
}

// Side-by-side sizes — brand colours stay baked into the SVG regardless
// of size, so this also doubles as a visual regression check for the
// SCSS sizing rule.
export const Sizes: Story = {
  render: () => ({
    setup: () => () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <SvgIcon svg={PluginRustIcon} size={16} />
        <SvgIcon svg={PluginRustIcon} size={32} />
        <SvgIcon svg={PluginRustIcon} size={64} />
        <SvgIcon svg={PluginRustIcon} size={128} />
      </div>
    ),
  }),
}
