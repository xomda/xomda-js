import type { Meta, StoryObj } from '@storybook/vue3'
import { AddIcon, DeleteIcon, EditIcon } from '@xomda/icons'
import { VList } from 'vuetify/components'

import { MenuDivider } from './MenuDivider'
import { MenuItem } from './MenuItem'
import { MenuSubheader } from './MenuSubheader'

const meta: Meta = {
  title: 'UI/Menu/Parts',
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj

/** The three menu building blocks render inside a `<VList>` so Vuetify's
 *  density + keyboard-navigation defaults apply consistently. */
export const AllParts: Story = {
  render: () => ({
    setup: () => () => (
      <VList density="compact" style={{ maxWidth: '280px' }}>
        <MenuSubheader title="File" />
        <MenuItem title="Rename" icon={EditIcon} shortcut="F2" />
        <MenuItem title="Move to folder…" icon={AddIcon} />
        <MenuDivider />
        <MenuItem title="Delete" icon={DeleteIcon} color="error" shortcut="⌫" />
      </VList>
    ),
  }),
}

export const WithCheckedState: Story = {
  render: () => ({
    setup: () => () => (
      <VList density="compact" style={{ maxWidth: '240px' }}>
        <MenuSubheader title="View mode" />
        <MenuItem title="Tree" checked />
        <MenuItem title="List" checked={false} />
        <MenuDivider />
        <MenuSubheader title="Sort by" />
        <MenuItem title="Name" checked />
        <MenuItem title="Modified date" checked={false} />
      </VList>
    ),
  }),
}

export const Disabled: Story = {
  render: () => ({
    setup: () => () => (
      <VList density="compact" style={{ maxWidth: '240px' }}>
        <MenuItem title="Available" icon={EditIcon} />
        <MenuItem title="Disabled — no permissions" icon={DeleteIcon} disabled />
      </VList>
    ),
  }),
}
