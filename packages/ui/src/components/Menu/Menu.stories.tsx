import type { Meta, StoryObj } from '@storybook/vue3'
import { AddIcon, DeleteIcon, EditIcon, FolderIcon } from '@xomda/icons'

import { Menu } from './Menu'

const meta: Meta<typeof Menu> = {
  component: Menu,
  title: 'UI/Menu',
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof Menu>

export const Basic: Story = {
  args: {
    items: [
      { title: 'Rename', icon: EditIcon, onClick: () => alert('rename') },
      { title: 'Duplicate', icon: AddIcon, onClick: () => alert('duplicate') },
      { divider: true },
      { title: 'Delete', icon: DeleteIcon, color: 'error', onClick: () => alert('delete') },
    ],
  },
}

export const WithSubheaderAndSubmenu: Story = {
  args: {
    items: [
      { subheader: 'File' },
      { title: 'New folder', icon: FolderIcon },
      {
        title: 'Move to',
        icon: FolderIcon,
        submenu: [{ title: 'Templates' }, { title: 'Drafts' }, { title: 'Archive' }],
      },
      { divider: true },
      { subheader: 'Danger zone' },
      { title: 'Delete', icon: DeleteIcon, color: 'error' },
    ],
  },
}

export const WithShortcuts: Story = {
  args: {
    items: [
      { title: 'Save', shortcut: '⌘S' },
      { title: 'Save as…', shortcut: '⇧⌘S' },
      { divider: true },
      { title: 'Close tab', shortcut: '⌘W' },
    ],
  },
}
