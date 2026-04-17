import type { Meta, StoryObj } from '@storybook/vue3'

import type { PackageData } from '../../types'
import { Package } from './Package'

const samplePackage: PackageData = {
  id: 'root',
  name: 'Core',
  description: 'Core domain models',
  packages: [
    {
      id: 'sub',
      name: 'Security',
      packages: [],
      enums: [],
      entities: [
        {
          id: 'user',
          name: 'User',
          attributes: [{ id: '1', name: 'username', type: 'string' }],
        },
      ],
    },
  ],
  enums: [
    {
      id: 'status',
      name: 'Status',
      values: [
        { id: '1', name: 'ACTIVE' },
        { id: '2', name: 'INACTIVE' },
      ],
    },
  ],
  entities: [
    {
      id: 'audit',
      name: 'AuditLog',
      attributes: [{ id: '1', name: 'timestamp', type: 'date' }],
    },
  ],
}

const meta: Meta<typeof Package> = {
  component: Package,
  title: 'Diagram/Package',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    package: { control: 'object' },
  },
}

export default meta
type Story = StoryObj<typeof Package>

export const Default: Story = {
  args: { package: samplePackage },
}

export const Empty: Story = {
  args: {
    package: {
      id: 'empty',
      name: 'EmptyPackage',
      packages: [],
      enums: [],
      entities: [],
    },
  },
}

export const Selected: Story = {
  args: { package: samplePackage, selected: true },
}
