import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { VBtn } from 'vuetify/components'

import { useUnsavedChangesPrompt } from '../../composables/useUnsavedChangesPrompt'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { UnsavedChangesDialogHost } from './UnsavedChangesDialogHost'

const meta: Meta<typeof UnsavedChangesDialog> = {
  component: UnsavedChangesDialog,
  title: 'UI/UnsavedChangesDialog',
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof UnsavedChangesDialog>

export const Default: Story = {
  render: () => ({
    setup() {
      const open = ref(true)
      return () => (
        <UnsavedChangesDialog
          modelValue={open.value}
          title="Unsaved changes"
          message='Save changes to "User.template.json" before closing?'
          onUpdate:modelValue={(v: boolean) => (open.value = v)}
        />
      )
    },
  }),
}

export const Loading: Story = {
  render: () => ({
    setup() {
      const open = ref(true)
      return () => (
        <UnsavedChangesDialog
          modelValue={open.value}
          message="Saving template..."
          loading
          onUpdate:modelValue={(v: boolean) => (open.value = v)}
        />
      )
    },
  }),
}

export const ViaComposable: Story = {
  name: 'Via useUnsavedChangesPrompt composable',
  render: () => ({
    setup() {
      const { promptUnsavedChanges } = useUnsavedChangesPrompt()
      const lastResult = ref<string>('')
      const trigger = async (): Promise<void> => {
        const choice = await promptUnsavedChanges({
          message: 'Save changes to "Customer.template.json" before closing?',
        })
        lastResult.value = choice
      }
      return () => (
        <div>
          <VBtn color="primary" onClick={trigger}>
            Trigger prompt
          </VBtn>
          <p class="mt-3 text-body-2 text-disabled">Last result: {lastResult.value || '—'}</p>
          <UnsavedChangesDialogHost />
        </div>
      )
    },
  }),
}
