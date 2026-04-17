import type { Meta, StoryObj } from '@storybook/vue3'
import { VList } from 'vuetify/components'

import { FileEntryListItem } from './FileEntryListItem'

const meta: Meta<typeof FileEntryListItem> = {
  component: FileEntryListItem,
  title: 'UI/FileEntryListItem',
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof FileEntryListItem>

export const File: Story = {
  args: { name: 'README.md', subtitle: '2.4 KB' },
  render: (args) => ({
    setup() {
      return () => (
        <VList>
          <FileEntryListItem {...args} />
        </VList>
      )
    },
  }),
}

export const Directory: Story = {
  args: { name: 'src', isDirectory: true },
  render: (args) => ({
    setup() {
      return () => (
        <VList>
          <FileEntryListItem {...args} />
        </VList>
      )
    },
  }),
}

export const ParentFolder: Story = {
  args: { name: '.. (Parent Folder)', isParent: true },
  render: (args) => ({
    setup() {
      return () => (
        <VList>
          <FileEntryListItem {...args} />
        </VList>
      )
    },
  }),
}

export const FolderListing: Story = {
  render: () => ({
    setup() {
      return () => (
        <VList>
          <FileEntryListItem name=".." isParent />
          <FileEntryListItem name="components" isDirectory />
          <FileEntryListItem name="composables" isDirectory />
          <FileEntryListItem name="stores" isDirectory />
          <FileEntryListItem name="index.ts" subtitle="312 B" />
          <FileEntryListItem name="env.d.ts" subtitle="78 B" />
        </VList>
      )
    },
  }),
}
