import type { Meta, StoryObj } from '@storybook/vue3'
import { AddIcon, DeleteIcon, EditIcon, ModelIcon, MoreIcon } from '@xomda/icons'
import { expect, fireEvent, fn, within } from 'storybook/test'

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

// Labelled variant: a title-bar dropdown ("Model: Main Model ⌄") that
// opens the same Menu used by the icon-only form. The visible label
// becomes the accessible name automatically.
export const Labeled: Story = {
  args: {
    onModelChange: fn(),
  } as unknown as Story['args'],
  render: (args) => ({
    setup() {
      const onClick = (name: string) => () =>
        (args as { onModelChange?: (n: string) => void }).onModelChange?.(name)
      return () => (
        <MenuButton
          label="Model: Main Model"
          items={[
            { subheader: 'Project' },
            { title: 'Main Model', icon: ModelIcon, checked: true, onClick: onClick('Main Model') },
            {
              title: 'Side Model',
              icon: ModelIcon,
              checked: false,
              onClick: onClick('Side Model'),
            },
            { divider: true },
            { title: 'New model in <project>…', icon: AddIcon, onClick: onClick('New') },
          ]}
        />
      )
    },
  }),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    await step('open menu', async () => {
      const btn = await canvas.findByRole('button', { name: /model:/i })
      await fireEvent.click(btn)
    })
    await step('label visible on activator', async () => {
      await expect(await canvas.findByText('Model: Main Model')).toBeInTheDocument()
    })
  },
}

// Multi-section layout used by the workspace selector: active-project
// models, then "Other projects" subheader with submenu per sub-project.
export const LabeledMultiSection: Story = {
  render: () => ({
    setup() {
      const noop = (msg: string) => () => alert(msg)
      return () => (
        <MenuButton
          label="root · Main Model"
          items={[
            { subheader: 'root' },
            { title: 'Main Model', icon: ModelIcon, checked: true, onClick: noop('Main') },
            { title: 'Tooling Model', icon: ModelIcon, checked: false, onClick: noop('Tool') },
            { divider: true, key: 'd1' },
            { title: 'New model in root…', icon: AddIcon, onClick: noop('NewRoot') },
            { divider: true, key: 'd2' },
            { subheader: 'Other projects' },
            {
              key: 'sub',
              title: 'sub',
              icon: ModelIcon,
              submenu: [
                { title: 'sub primary', icon: ModelIcon, onClick: noop('sub-primary') },
                { divider: true },
                { title: 'New model in sub…', icon: AddIcon, onClick: noop('NewSub') },
              ],
            },
          ]}
        />
      )
    },
  }),
}
