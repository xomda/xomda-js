import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'

import { ViewModeToggle } from './ViewModeToggle'

const meta: Meta<typeof ViewModeToggle> = {
  component: ViewModeToggle,
  title: 'UI/ViewModeToggle',
}

export default meta
type Story = StoryObj<typeof ViewModeToggle>

export const Tree: Story = {
  render: () => ({
    setup() {
      const mode = ref<'tree' | 'list'>('tree')
      return () => (
        <div>
          <ViewModeToggle
            modelValue={mode.value}
            onUpdate:modelValue={(v: 'tree' | 'list') => (mode.value = v)}
          />
          <div class="text-caption mt-2">selected: {mode.value}</div>
        </div>
      )
    },
  }),
}

export const List: Story = {
  render: () => ({
    setup() {
      const mode = ref<'tree' | 'list'>('list')
      return () => (
        <ViewModeToggle
          modelValue={mode.value}
          onUpdate:modelValue={(v: 'tree' | 'list') => (mode.value = v)}
        />
      )
    },
  }),
}
