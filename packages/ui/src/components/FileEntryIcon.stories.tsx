import type { Meta, StoryObj } from '@storybook/vue3'
import { CodeXmlIcon, PluginMavenIcon } from '@xomda/icons'

import { FileEntryIcon } from './FileEntryIcon'

const meta: Meta<typeof FileEntryIcon> = {
  component: FileEntryIcon,
  title: 'UI/FileEntryIcon',
}

export default meta
type Story = StoryObj<typeof FileEntryIcon>

export const FileDefault: Story = {
  render: () => ({
    setup: () => () => <FileEntryIcon />,
  }),
}

export const Directory: Story = {
  render: () => ({
    setup: () => () => <FileEntryIcon isDirectory />,
  }),
}

export const WithOverlayIcon: Story = {
  render: () => ({
    setup: () => () => <FileEntryIcon icon={CodeXmlIcon} />,
  }),
}

export const Large: Story = {
  render: () => ({
    setup: () => () => <FileEntryIcon size={64} />,
  }),
}

export const Tinted: Story = {
  render: () => ({
    setup: () => () => <FileEntryIcon isDirectory color="#1976d2" />,
  }),
}

// Plugin-contributed glyph that replaces the default file shape. Maven's
// brand mark (the devicon multi-color SVG) — the same icon the Maven
// plugin uses for pom.xml. Multi-color brand glyphs ignore
// `primaryColor` and keep their own palette.
export const PluginPrimary: Story = {
  render: () => ({
    setup: () => () => <FileEntryIcon primaryIcon={PluginMavenIcon} size={48} />,
  }),
}
