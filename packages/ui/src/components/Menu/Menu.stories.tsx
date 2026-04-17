import type { Meta, StoryObj } from '@storybook/vue3'
import { AddIcon, DeleteIcon, EditIcon, FolderIcon, MoreIcon } from '@xomda/icons'
import { action } from 'storybook/actions'

import { Menu } from './Menu'
import { MenuButton } from './MenuButton'

const meta: Meta<typeof Menu> = {
  component: Menu,
  title: 'UI/Menu',
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof Menu>

const click = (name: string) => action(`click:${name}`)

export const Basic: Story = {
  args: {
    items: [
      { title: 'Rename', icon: EditIcon, onClick: click('Rename') },
      { title: 'Duplicate', icon: AddIcon, onClick: click('Duplicate') },
      { divider: true },
      { title: 'Delete', icon: DeleteIcon, color: 'error', onClick: click('Delete') },
    ],
  },
}

export const WithSubheaderAndSubmenu: Story = {
  args: {
    items: [
      { subheader: 'File' },
      { title: 'New folder', icon: FolderIcon, onClick: click('New folder') },
      {
        title: 'Move to',
        icon: FolderIcon,
        submenu: [
          { title: 'Templates', onClick: click('Move to Templates') },
          { title: 'Drafts', onClick: click('Move to Drafts') },
          { title: 'Archive', onClick: click('Move to Archive') },
        ],
      },
      { divider: true },
      { subheader: 'Danger zone' },
      { title: 'Delete', icon: DeleteIcon, color: 'error', onClick: click('Delete') },
    ],
  },
}

export const WithShortcuts: Story = {
  args: {
    items: [
      { title: 'Save', shortcut: 'ctrl+s', onClick: click('Save') },
      { title: 'Save as…', shortcut: 'ctrl+shift+s', onClick: click('Save as') },
      { divider: true },
      { title: 'Close tab', shortcut: 'ctrl+w', onClick: click('Close tab') },
    ],
  },
}

export const Checked: Story = {
  args: {
    items: [
      { subheader: 'Tri-state checked' },
      { title: 'Off (false)', checked: false, onClick: click('Off') },
      { title: 'On (true)', checked: true, onClick: click('On') },
      { title: 'No column (undefined)', onClick: click('No column') },
    ],
  },
}

export const HoverSubmenu: Story = {
  args: {
    items: [
      {
        title: 'Sort by',
        submenu: [
          { title: 'Name', checked: true, onClick: click('Sort by name') },
          { title: 'Modified', onClick: click('Sort by modified') },
          { title: 'Size', onClick: click('Sort by size') },
        ],
      },
      {
        title: 'Filter',
        submenu: [
          { title: 'All', onClick: click('All') },
          { title: 'Generated only', onClick: click('Generated only') },
        ],
      },
    ],
  },
}

export const EmptySubmenuFallback: Story = {
  args: {
    items: [
      { title: 'No options', submenu: [] },
      { title: 'Custom empty text', submenu: [], emptyText: '(nothing here yet)' },
    ],
  },
}

export const GroupWithTitleSlot: Story = {
  args: {
    items: [
      {
        group: true,
        title: 'View as',
        items: [
          { title: 'Tree', checked: true, onClick: click('View as tree') },
          { title: 'List', checked: false, onClick: click('View as list') },
        ],
      },
      { divider: true },
      {
        group: true,
        title: 'Show',
        items: [
          { title: 'Hidden files', checked: false, onClick: click('Show hidden') },
          { title: 'Generated', checked: true, onClick: click('Show generated') },
        ],
      },
    ],
  },
}

export const WithMenuButtonActivator = {
  render: () => () => (
    <MenuButton
      tooltip="View options"
      icon={MoreIcon}
      items={[
        { title: 'Tree', checked: true, onClick: click('Tree') },
        { title: 'List', checked: false, onClick: click('List') },
        { divider: true },
        { title: 'Show hidden', checked: false, onClick: click('Show hidden') },
      ]}
    />
  ),
}
