import type { Meta, StoryObj } from '@storybook/vue3'
import {
  PluginPrettierIcon,
  PluginStylelintIcon,
  PluginTypeScriptIcon,
  PluginXomdaIcon,
} from '@xomda/icons'

import { PluginIcon } from './PluginIcon'

const meta: Meta<typeof PluginIcon> = {
  component: PluginIcon,
  title: 'UI/PluginIcon',
  argTypes: {
    icon: { control: 'text' },
    size: { control: { type: 'number', min: 12, max: 256, step: 4 } },
    color: { control: 'color' },
  },
}

export default meta
type Story = StoryObj<typeof PluginIcon>

// Devicon — full multi-colour SVG markup; routes through `SvgIcon`.
// Brand fill stays baked in; the `color` prop is ignored on this branch.
export const Devicon: Story = {
  args: { icon: PluginTypeScriptIcon, size: 48, label: 'TypeScript' },
}

// Material fallback — monochrome path string; routes through `VIcon` so
// `color` (and Vuetify theme `currentColor`) takes effect.
export const MaterialFallback: Story = {
  args: { icon: PluginPrettierIcon, size: 48, color: 'primary' },
}

// Same component side-by-side, showing how the auto-discriminator
// handles a mixed list (a row of plugin chips, say).
export const Mixed: Story = {
  render: () => ({
    setup: () => () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <PluginIcon icon={PluginTypeScriptIcon} size={32} label="TypeScript" />
        <PluginIcon icon={PluginPrettierIcon} size={32} label="Prettier" />
        <PluginIcon icon={PluginStylelintIcon} size={32} label="Stylelint" color="primary" />
        <PluginIcon icon={PluginXomdaIcon} size={32} label="Xomda" />
      </div>
    ),
  }),
}
