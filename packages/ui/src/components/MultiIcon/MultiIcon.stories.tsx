import type { Meta, StoryObj } from '@storybook/vue3'
import { EntityIcon, EnumIcon, PackageIcon, TemplatesIcon } from '@xomda/icons'

import { MultiIcon } from './MultiIcon'

const meta: Meta<typeof MultiIcon> = {
  component: MultiIcon,
  title: 'UI/MultiIcon',
}

export default meta
type Story = StoryObj<typeof MultiIcon>

const sampleIcons = [
  { icon: EntityIcon, label: 'Entity', color: '#1976d2' },
  { icon: EnumIcon, label: 'Enum', color: '#388e3c' },
  { icon: PackageIcon, label: 'Package', color: '#7b1fa2' },
  { icon: TemplatesIcon, label: 'Templates', color: '#f57c00' },
]

export const Default: Story = {
  render: () => ({
    setup: () => () => <MultiIcon icons={sampleIcons} />,
  }),
}

export const WithOverflow: Story = {
  render: () => ({
    setup: () => () => (
      <MultiIcon
        icons={[
          ...sampleIcons,
          { icon: EntityIcon, label: 'Extra 1' },
          { icon: EntityIcon, label: 'Extra 2' },
        ]}
        max={3}
      />
    ),
  }),
}

export const LargeSize: Story = {
  render: () => ({
    setup: () => () => <MultiIcon icons={sampleIcons} size={24} />,
  }),
}

export const SingleIcon: Story = {
  render: () => ({
    setup: () => () => <MultiIcon icons={[sampleIcons[0]]} />,
  }),
}
