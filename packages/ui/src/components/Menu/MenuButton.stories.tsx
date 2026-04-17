import type { Meta, StoryObj } from '@storybook/vue3'
import { AddIcon, DeleteIcon, EditIcon, MoreIcon } from '@xomda/icons'

import { MenuButton } from './MenuButton'

const meta: Meta<typeof MenuButton> = {
  component: MenuButton,
  title: 'UI/MenuButton',
}

export default meta
type Story = StoryObj<typeof MenuButton>

const sampleItems = [
  { title: 'Rename', icon: EditIcon, onClick: () => alert('Rename') },
  { title: 'Move to folder…', icon: AddIcon, onClick: () => alert('Move') },
  { title: 'Delete', icon: DeleteIcon, color: 'error', onClick: () => alert('Delete') },
]

export const Default: Story = {
  render: () => ({
    setup: () => () => (
      <MenuButton items={sampleItems} tooltip="More actions" aria-label="More actions" />
    ),
  }),
}

export const WithCustomIcon: Story = {
  render: () => ({
    setup: () => () => <MenuButton items={sampleItems} icon={MoreIcon} tooltip="Open menu" />,
  }),
}

export const Disabled: Story = {
  render: () => ({
    setup: () => () => (
      <MenuButton items={sampleItems} tooltip="Disabled" disabled aria-label="Disabled menu" />
    ),
  }),
}

export const NoTooltip: Story = {
  render: () => ({
    setup: () => () => <MenuButton items={sampleItems} aria-label="More" />,
  }),
}
