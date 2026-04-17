import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { VBtn } from 'vuetify/components'

import { usePrompt } from '../../composables/usePrompt'
import { PromptDialog } from './PromptDialog'
import { PromptDialogHost } from './PromptDialogHost'

const meta: Meta<typeof PromptDialog> = {
  component: PromptDialog,
  title: 'UI/PromptDialog',
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof PromptDialog>

export const Default: Story = {
  render: () => ({
    setup() {
      const open = ref(true)
      const value = ref('')
      return () => (
        <PromptDialog
          modelValue={open.value}
          title="New folder"
          label="Folder name"
          value={value.value}
          confirmLabel="Create"
          onUpdate:value={(v: string) => (value.value = v)}
          onUpdate:modelValue={(v: boolean) => (open.value = v)}
        />
      )
    },
  }),
}

export const WithError: Story = {
  render: () => ({
    setup() {
      const open = ref(true)
      const value = ref('')
      return () => (
        <PromptDialog
          modelValue={open.value}
          title="Rename template"
          label="Template name"
          value={value.value}
          error="Name is required"
          confirmLabel="Rename"
          onUpdate:value={(v: string) => (value.value = v)}
          onUpdate:modelValue={(v: boolean) => (open.value = v)}
        />
      )
    },
  }),
}

export const ViaUsePrompt: Story = {
  name: 'Via usePrompt composable',
  render: () => ({
    setup() {
      const { prompt } = usePrompt()
      const lastResult = ref<string>('')
      const trigger = async (): Promise<void> => {
        const result = await prompt({
          title: 'New folder',
          label: 'Folder name',
          confirmLabel: 'Create',
          validate: (v) => (v.trim() ? null : 'Name is required'),
        })
        lastResult.value = result == null ? 'cancelled' : `value: ${result}`
      }
      return () => (
        <div>
          <VBtn color="primary" onClick={trigger}>
            Trigger prompt
          </VBtn>
          <p class="mt-3 text-body-2 text-disabled">Last result: {lastResult.value || '—'}</p>
          <PromptDialogHost />
        </div>
      )
    },
  }),
}
