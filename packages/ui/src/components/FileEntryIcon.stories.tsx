import type { Meta, StoryObj } from '@storybook/vue3'

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
    setup: () => () => <FileEntryIcon icon="material-symbols-light:javascript" />,
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
